/**
 * Browser client for POST /api/ai. It:
 * - de-duplicates identical in-flight requests and caches answers for the session,
 * - times out, and maps every failure to a small set of error codes,
 * - re-validates the response shape in the browser and never trusts the network blindly.
 */
import * as z from 'zod/mini';

import {
  AI_OUTPUT_SCHEMAS,
  AiMetaSchema,
  type AiOutputByTask,
  type AiRequest,
  type AiTask,
} from '../core/contract';
import type { AiSource } from '../core/constants/enums';

export const AI_ENDPOINT = '/api/ai';
/** Slightly longer than the server's 50 s chain deadline, so the server's answer always wins. */
export const CLIENT_TIMEOUT_MS = 55_000;
const MAX_CACHE = 30;

export type AiClientErrorCode =
  'unavailable' | 'rate_limited' | 'input_rejected' | 'invalid_request' | 'server_error';

export class AiClientError extends Error {
  constructor(
    readonly code: AiClientErrorCode,
    message: string,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'AiClientError';
  }
}

export interface AiResult<T extends AiTask> {
  data: AiOutputByTask[T];
  source: AiSource;
  model: string | null;
}

const ErrorEnvelope = z.object({ ok: z.literal(false), error: z.object({ message: z.string() }) });

const cache = new Map<string, AiResult<AiTask>>();
const inFlight = new Map<string, Promise<AiResult<AiTask>>>();

export function clearAiCache(): void {
  cache.clear();
  inFlight.clear();
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function send<T extends AiTask>(
  request: Extract<AiRequest, { task: T }>,
  fetchImpl: typeof fetch,
): Promise<AiResult<T>> {
  let response: Response;
  try {
    response = await fetchImpl(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
  } catch {
    throw new AiClientError('unavailable', 'The AI service could not be reached.');
  }

  const body = await readJson(response);
  if (!response.ok) {
    const message =
      ErrorEnvelope.safeParse(body).data?.error.message ?? 'The AI service is unavailable.';
    if (response.status === 429) {
      const retry = Number(response.headers.get('retry-after'));
      throw new AiClientError(
        'rate_limited',
        message,
        Number.isFinite(retry) && retry > 0 ? retry : null,
      );
    }
    if (response.status === 422) throw new AiClientError('input_rejected', message);
    if (response.status === 400) throw new AiClientError('invalid_request', message);
    // 404/405 mean no API on this host (e.g. a static preview), 5xx a server fault: both are "unavailable".
    throw new AiClientError(response.status >= 500 ? 'server_error' : 'unavailable', message);
  }

  const envelope = z
    .object({
      ok: z.literal(true),
      task: z.literal(request.task),
      data: z.unknown(),
      meta: AiMetaSchema,
    })
    .safeParse(body);
  const schema = AI_OUTPUT_SCHEMAS[request.task] as unknown as z.ZodMiniType<AiOutputByTask[T]>;
  const data = envelope.success ? schema.safeParse(envelope.data.data) : null;
  if (!envelope.success || !data?.success)
    throw new AiClientError('server_error', 'The AI service sent an unexpected answer.');
  return { data: data.data, source: envelope.data.meta.source, model: envelope.data.meta.model };
}

export function requestAi<T extends AiTask>(
  request: Extract<AiRequest, { task: T }>,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): Promise<AiResult<T>> {
  const key = JSON.stringify(request);
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached as AiResult<T>);
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<AiResult<T>>;

  const promise = send(request, fetchImpl)
    .then((result) => {
      if (result.source !== 'rules') {
        cache.set(key, result);
        if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value ?? '');
      }
      return result;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
