/**
 * POST /api/ai request pipeline:
 * method → origin → content type → size → JSON → schema → rate limit → injection screen → cache →
 * provider chain → deterministic fallback. Each failure gets a precise status and a generic message,
 * never internals.
 */
import {
  AiRequestSchema,
  type AiRequest,
  type AiSuccessBody,
  type AiTask,
} from '../../src/core/contract.js';
import { cacheKey, type TtlCache } from '../cache.js';
import type { ServerConfig } from '../config.js';
import { errorResponse, jsonResponse } from '../http.js';
import type { Logger } from '../log.js';
import { looksLikePromptInjection } from '../security/injection.js';
import { clientKey, type RateLimiter } from '../security/rateLimit.js';
import { isAllowedOrigin, isJsonContentType, readBoundedBody } from '../security/requestGuards.js';
import type { CircuitBreaker } from './breaker.js';
import { runProviderChain } from './chain.js';
import type { AiProvider } from './providers/types.js';
import { withTaskSpec, type RequestFor, type TaskSpec } from './tasks.js';

/** Fields of the request schema named in an "invalid request" message. */
const MAX_INVALID_FIELDS = 5;

export interface HandlerDeps {
  config: ServerConfig;
  providers: readonly AiProvider[];
  cache: TtlCache<AiSuccessBody<AiTask>>;
  limiter: RateLimiter;
  breaker: CircuitBreaker;
  logger: Logger;
  randomId: () => string;
  now?: () => number;
}

interface Context {
  request: Request;
  deps: HandlerDeps;
  requestId: string;
}

/** A guard either rejects the request with a response or lets it through (undefined). */
type Guard = (context: Context) => Response | undefined;

const methodGuard: Guard = ({ request, requestId }) =>
  request.method === 'POST'
    ? undefined
    : errorResponse(405, 'method_not_allowed', 'Use POST.', {
        requestId,
        headers: { Allow: 'POST' },
      });

const originGuard: Guard = ({ request, deps, requestId }) =>
  isAllowedOrigin(request, deps.config.allowedOrigins)
    ? undefined
    : errorResponse(403, 'forbidden_origin', 'Cross-origin requests are not allowed.', {
        requestId,
      });

const contentTypeGuard: Guard = ({ request, requestId }) =>
  isJsonContentType(request)
    ? undefined
    : errorResponse(415, 'unsupported_media_type', 'Send application/json.', { requestId });

const rateLimitGuard: Guard = ({ request, deps, requestId }) => {
  const limit = deps.limiter.check(clientKey(request));
  if (limit.allowed) return undefined;
  return errorResponse(429, 'rate_limited', 'Too many requests. Please wait a moment.', {
    requestId,
    headers: {
      'Retry-After': String(limit.retryAfterSeconds),
    },
  });
};

/** Checks that need no body, in order. */
const HEADER_GUARDS: readonly Guard[] = [methodGuard, originGuard, contentTypeGuard];

/** Reads and validates the body: size cap, JSON, then the request schema. */
async function parseRequest(context: Context): Promise<AiRequest | Response> {
  const { requestId } = context;
  const body = await readBoundedBody(context.request);
  if (!body.ok)
    return errorResponse(413, 'payload_too_large', 'The request is too large.', { requestId });
  let json: unknown;
  try {
    json = JSON.parse(body.text);
  } catch {
    return errorResponse(400, 'invalid_json', 'The request body is not valid JSON.', { requestId });
  }
  const parsed = AiRequestSchema.safeParse(json);
  if (parsed.success) return parsed.data;
  const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.') || 'body'))];
  const named = fields.slice(0, MAX_INVALID_FIELDS).join(', ');
  return errorResponse(400, 'invalid_request', `Invalid fields: ${named}`, { requestId });
}

function injectionGuard({ deps, requestId }: Context, aiRequest: AiRequest): Response | undefined {
  const suspicious = withTaskSpec(aiRequest, (spec, request) =>
    spec.userText(request).some(looksLikePromptInjection),
  );
  if (!suspicious) return undefined;
  deps.logger.warn('input_rejected', {
    requestId,
    task: aiRequest.task,
    outcome: 'injection_pattern',
  });
  return errorResponse(422, 'input_rejected', 'Please describe your event in your own words.', {
    requestId,
  });
}

/** Asks the providers in order, and answers with the deterministic rules when all of them fail. */
async function answer<T extends AiTask>(
  spec: TaskSpec<T>,
  request: RequestFor<T>,
  { deps, requestId }: Context,
): Promise<AiSuccessBody<T>> {
  const result = await runProviderChain(deps.providers, spec, request, {
    providerTimeoutMs: deps.config.timeouts.providerMs,
    totalTimeoutMs: deps.config.timeouts.totalMs,
    breaker: deps.breaker,
    logger: deps.logger,
    requestId,
    ...(deps.now ? { now: deps.now } : {}),
  });
  const meta = result
    ? { source: result.provider.source, model: result.provider.model }
    : { source: 'rules' as const, model: null };
  return {
    ok: true,
    task: request.task,
    data: result ? result.output : spec.fallback(request),
    meta: { ...meta, cached: false, requestId },
  };
}

async function respond(aiRequest: AiRequest, context: Context): Promise<Response> {
  const { deps, requestId } = context;
  const promptVersion = withTaskSpec(aiRequest, (spec) => spec.promptVersion);
  // The prompt version is part of the key, so editing a prompt never serves answers to the old one.
  const key = cacheKey({ promptVersion, request: aiRequest });
  const cached = deps.cache.get(key);
  if (cached) {
    deps.logger.info('cache_hit', { requestId, task: aiRequest.task, cached: true });
    const meta = { ...cached.meta, cached: true, requestId };
    return jsonResponse(200, { ...cached, meta }, { 'X-Request-Id': requestId });
  }
  const result = await withTaskSpec(aiRequest, (spec, request) => answer(spec, request, context));
  if (result.meta.source !== 'rules') deps.cache.set(key, result);
  return jsonResponse(200, result, { 'X-Request-Id': requestId });
}

/** Handles POST /api/ai end to end. Always answers: a validated model result, the rules, or an error. */
export async function handleAiRequest(request: Request, deps: HandlerDeps): Promise<Response> {
  const context: Context = { request, deps, requestId: deps.randomId() };
  for (const guard of HEADER_GUARDS) {
    const rejected = guard(context);
    if (rejected) return rejected;
  }
  const aiRequest = await parseRequest(context);
  if (aiRequest instanceof Response) return aiRequest;
  const rejected = rateLimitGuard(context) ?? injectionGuard(context, aiRequest);
  if (rejected) return rejected;
  try {
    return await respond(aiRequest, context);
  } catch (error) {
    deps.logger.error('handler_error', {
      requestId: context.requestId,
      task: aiRequest.task,
      outcome: error instanceof Error ? error.name : 'unknown',
    });
    return errorResponse(500, 'internal_error', 'Something went wrong. Please try again.', {
      requestId: context.requestId,
    });
  }
}
