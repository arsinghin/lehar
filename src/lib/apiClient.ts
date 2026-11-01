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
  type TaskRequest,
} from '../core/contract';
import type { AiSource } from '../core/constants/enums';
import { LruMap } from '../core/lruMap';

export const AI_ENDPOINT = '/api/ai';
/** Slightly longer than the server's 50 s chain deadline, so the server's answer always wins. */
export const CLIENT_TIMEOUT_MS = 55_000;
/** Answers remembered per browser session. */
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

const cache = new LruMap<string, AiResult<AiTask>>(MAX_CACHE);
const inFlight = new Map<string, Promise<AiResult<AiTask>>>();

/** Forgets cached and in-flight answers, so each test starts clean. */
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

/** Narrows a stored result to its task by validating it again, instead of casting. */
function resultFor<T extends AiTask>(task: T, result: AiResult<AiTask>): AiResult<T> {
  const data = AI_OUTPUT_SCHEMAS[task].safeParse(result.data);
  if (!data.success)
    throw new AiClientError('server_error', 'The AI service sent an unexpected answer.');
  return { ...result, data: data.data };
}

async function post(request: AiRequest, fetchImpl: typeof fetch): Promise<Response> {
  try {
    return await fetchImpl(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
  } catch {
    throw new AiClientError('unavailable', 'The AI service could not be reached.');
  }
}

function retryAfterSeconds(response: Response): number | null {
  const retry = Number(response.headers.get('retry-after'));
  return Number.isFinite(retry) && retry > 0 ? retry : null;
}

/** HTTP statuses the host can act on; anything else means the service is unavailable or failing. */
const ERROR_CODE_BY_STATUS: Readonly<Record<number, AiClientErrorCode>> = {
  400: 'invalid_request',
  422: 'input_rejected',
  429: 'rate_limited',
};

function errorFor(response: Response, body: unknown): AiClientError {
  const message =
    ErrorEnvelope.safeParse(body).data?.error.message ?? 'The AI service is unavailable.';
  // 404/405 mean no API on this host (e.g. a static preview), 5xx a server fault.
  const code =
    ERROR_CODE_BY_STATUS[response.status] ??
    (response.status >= 500 ? 'server_error' : 'unavailable');
  return new AiClientError(
    code,
    message,
    code === 'rate_limited' ? retryAfterSeconds(response) : null,
  );
}

function answerFor<T extends AiTask>(task: T, body: unknown): AiResult<T> {
  const envelope = z
    .object({ ok: z.literal(true), task: z.literal(task), data: z.unknown(), meta: AiMetaSchema })
    .safeParse(body);
  const data = envelope.success ? AI_OUTPUT_SCHEMAS[task].safeParse(envelope.data.data) : null;
  if (!envelope.success || !data?.success) {
    throw new AiClientError('server_error', 'The AI service sent an unexpected answer.');
  }
  return { data: data.data, source: envelope.data.meta.source, model: envelope.data.meta.model };
}

async function send<T extends AiTask>(
  request: TaskRequest<T>,
  fetchImpl: typeof fetch,
): Promise<AiResult<T>> {
  const response = await post(request, fetchImpl);
  const body = await readJson(response);
  if (!response.ok) throw errorFor(response, body);
  return answerFor(request.task, body);
}

/** Sends one AI request, reusing a cached answer or an identical request that is still in flight. */
export function requestAi<T extends AiTask>(
  request: TaskRequest<T>,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): Promise<AiResult<T>> {
  const key = JSON.stringify(request);
  const cached = cache.get(key);
  if (cached) return Promise.resolve(resultFor(request.task, cached));
  const pending = inFlight.get(key);
  if (pending) return pending.then((result) => resultFor(request.task, result));

  const promise = send(request, fetchImpl)
    .then((result) => {
      if (result.source !== 'rules') cache.set(key, result);
      return result;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
