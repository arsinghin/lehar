/**
 * Provider fallback chain with per-attempt timeouts, an overall deadline and a circuit breaker.
 * Order: Gemini Flash → Gemini Flash-Lite → OpenRouter free models → NVIDIA NIM. The caller falls
 * back to the built-in rules when every provider fails.
 */
import type { AiOutputByTask, AiTask } from '../../src/core/contract.js';
import type { Logger } from '../log.js';
import type { CircuitBreaker } from './breaker.js';
import { extractJsonObject } from './parse.js';
import { SYSTEM_PROMPT } from './prompts.js';
import { ProviderError, toProviderError, type AiProvider } from './providers/types.js';
import type { RequestFor, TaskSpec } from './tasks.js';

export interface ChainOptions {
  providerTimeoutMs: number;
  totalTimeoutMs: number;
  breaker: CircuitBreaker;
  logger: Logger;
  requestId: string;
  now?: () => number;
}

export interface ChainResult<T extends AiTask> {
  output: AiOutputByTask[T];
  provider: AiProvider;
}

/** Below this much remaining time, another attempt would only waste quota. */
const MIN_ATTEMPT_MS = 1_500;
/** Log outcomes are short reasons, never content. */
const MAX_OUTCOME_LENGTH = 80;

interface Attempt<T extends AiTask> {
  provider: AiProvider;
  spec: TaskSpec<T>;
  prompt: string;
  timeoutMs: number;
}

/** One provider call: generate, parse, validate and sanitize. Throws a ProviderError on any failure. */
async function attempt<T extends AiTask>({
  provider,
  spec,
  prompt,
  timeoutMs,
}: Attempt<T>): Promise<AiOutputByTask[T]> {
  const text = await provider.generate({
    system: SYSTEM_PROMPT,
    prompt,
    jsonSchema: spec.jsonSchema,
    maxOutputTokens: spec.maxOutputTokens,
    signal: AbortSignal.timeout(timeoutMs),
  });
  let json: unknown;
  try {
    json = extractJsonObject(text);
  } catch {
    throw new ProviderError('Model returned invalid JSON');
  }
  const validated = spec.outputSchema.safeParse(json);
  if (!validated.success) throw new ProviderError('Model output failed schema validation');
  const output = spec.postProcess(validated.data);
  if (output === null) throw new ProviderError('Model output had no usable content');
  return output;
}

/** Tries each provider in order and returns the first valid answer, or null when all fail. */
export async function runProviderChain<T extends AiTask>(
  providers: readonly AiProvider[],
  spec: TaskSpec<T>,
  request: RequestFor<T>,
  options: ChainOptions,
): Promise<ChainResult<T> | null> {
  const now = options.now ?? Date.now;
  const started = now();
  const prompt = spec.buildPrompt(request);
  const base = { requestId: options.requestId, task: request.task };

  for (const provider of providers) {
    if (options.breaker.isOpen(provider.id)) {
      options.logger.info('provider_skipped', {
        ...base,
        provider: provider.id,
        outcome: 'circuit_open',
      });
      continue;
    }
    const remaining = options.totalTimeoutMs - (now() - started);
    if (remaining < MIN_ATTEMPT_MS) break;
    const timeoutMs = Math.min(provider.timeoutMs ?? options.providerTimeoutMs, remaining);
    const attemptStarted = now();
    try {
      const output = await attempt({ provider, spec, prompt, timeoutMs });
      options.breaker.reset(provider.id);
      options.logger.info('provider_ok', {
        ...base,
        provider: provider.id,
        ms: now() - attemptStarted,
        outcome: 'ok',
      });
      return { output, provider };
    } catch (error) {
      const failure = toProviderError(error);
      if (failure.isTransient) options.breaker.trip(provider.id);
      options.logger.warn('provider_failed', {
        ...base,
        provider: provider.id,
        ms: now() - attemptStarted,
        outcome: failure.message.slice(0, MAX_OUTCOME_LENGTH),
        ...(failure.status !== null ? { status: failure.status } : {}),
      });
    }
  }
  return null;
}
