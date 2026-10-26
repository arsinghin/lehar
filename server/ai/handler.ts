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
import { runProviderChain, type CircuitBreaker } from './chain.js';
import type { AiProvider } from './providers/types.js';
import { TASKS, type TaskSpec } from './tasks.js';

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

async function respond<T extends AiTask>(
  request: Extract<AiRequest, { task: T }>,
  deps: HandlerDeps,
  requestId: string,
): Promise<AiSuccessBody<T>> {
  const spec = TASKS[request.task] as TaskSpec<T>;
  const result = await runProviderChain(deps.providers, spec, request, {
    providerTimeoutMs: deps.config.timeouts.providerMs,
    totalTimeoutMs: deps.config.timeouts.totalMs,
    breaker: deps.breaker,
    logger: deps.logger,
    requestId,
    ...(deps.now ? { now: deps.now } : {}),
  });
  if (result) {
    return {
      ok: true,
      task: request.task,
      data: result.output,
      meta: {
        source: result.provider.source,
        model: result.provider.model,
        cached: false,
        requestId,
      },
    };
  }
  return {
    ok: true,
    task: request.task,
    data: spec.fallback(request),
    meta: { source: 'rules', model: null, cached: false, requestId },
  };
}

export async function handleAiRequest(request: Request, deps: HandlerDeps): Promise<Response> {
  const requestId = deps.randomId();
  if (request.method !== 'POST') {
    return errorResponse(405, 'method_not_allowed', 'Use POST.', requestId, { Allow: 'POST' });
  }
  if (!isAllowedOrigin(request, deps.config.allowedOrigins)) {
    return errorResponse(
      403,
      'forbidden_origin',
      'Cross-origin requests are not allowed.',
      requestId,
    );
  }
  if (!isJsonContentType(request)) {
    return errorResponse(415, 'unsupported_media_type', 'Send application/json.', requestId);
  }
  const body = await readBoundedBody(request);
  if (!body.ok)
    return errorResponse(413, 'payload_too_large', 'The request is too large.', requestId);

  let json: unknown;
  try {
    json = JSON.parse(body.text);
  } catch {
    return errorResponse(400, 'invalid_json', 'The request body is not valid JSON.', requestId);
  }
  const parsed = AiRequestSchema.safeParse(json);
  if (!parsed.success) {
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join('.') || 'body')),
    ].slice(0, 5);
    return errorResponse(400, 'invalid_request', `Invalid fields: ${fields.join(', ')}`, requestId);
  }
  const aiRequest = parsed.data;

  const limit = deps.limiter.check(clientKey(request));
  if (!limit.allowed) {
    return errorResponse(
      429,
      'rate_limited',
      'Too many requests. Please wait a moment.',
      requestId,
      {
        'Retry-After': String(limit.retryAfterSeconds),
      },
    );
  }

  const spec = TASKS[aiRequest.task] as TaskSpec<AiTask>;
  if (spec.userText(aiRequest).some(looksLikePromptInjection)) {
    deps.logger.warn('input_rejected', {
      requestId,
      task: aiRequest.task,
      outcome: 'injection_pattern',
    });
    return errorResponse(
      422,
      'input_rejected',
      'Please describe your event in your own words.',
      requestId,
    );
  }

  const key = cacheKey(aiRequest);
  const cached = deps.cache.get(key);
  if (cached) {
    deps.logger.info('cache_hit', { requestId, task: aiRequest.task, cached: true });
    return jsonResponse(
      200,
      { ...cached, meta: { ...cached.meta, cached: true, requestId } },
      { 'X-Request-Id': requestId },
    );
  }

  try {
    const result = await respond(aiRequest, deps, requestId);
    if (result.meta.source !== 'rules') deps.cache.set(key, result);
    return jsonResponse(200, result, { 'X-Request-Id': requestId });
  } catch {
    deps.logger.warn('handler_error', { requestId, task: aiRequest.task, outcome: 'unexpected' });
    return errorResponse(
      500,
      'internal_error',
      'Something went wrong. Please try again.',
      requestId,
    );
  }
}
