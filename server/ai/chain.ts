/**
 * Provider fallback chain with per-attempt timeouts, an overall deadline and a circuit breaker.
 * Order: Gemini Flash → Gemini Flash-Lite → OpenRouter free models. The caller falls back to rules.
 */
import type { AiOutputByTask, AiRequest, AiTask } from '../../src/core/contract.js';
import { extractJsonObject } from '../security/sanitize.js';
import type { Logger } from '../log.js';
import { SYSTEM_PROMPT } from './prompts.js';
import { ProviderError, toProviderError, type AiProvider } from './providers/types.js';
import type { TaskSpec } from './tasks.js';

/** Skips a provider for a while after a quota, overload or timeout error, to protect free quotas. */
export class CircuitBreaker {
  private readonly openUntil = new Map<string, number>();

  constructor(
    private readonly cooldownMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  isOpen(id: string): boolean {
    const until = this.openUntil.get(id);
    if (until === undefined) return false;
    if (until <= this.now()) {
      this.openUntil.delete(id);
      return false;
    }
    return true;
  }

  trip(id: string): void {
    this.openUntil.set(id, this.now() + this.cooldownMs);
  }

  reset(id: string): void {
    this.openUntil.delete(id);
  }
}

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

export async function runProviderChain<T extends AiTask>(
  providers: readonly AiProvider[],
  spec: TaskSpec<T>,
  request: Extract<AiRequest, { task: T }>,
  options: ChainOptions,
): Promise<ChainResult<T> | null> {
  const now = options.now ?? Date.now;
  const started = now();
  const prompt = spec.buildPrompt(request);

  for (const provider of providers) {
    if (options.breaker.isOpen(provider.id)) {
      options.logger.info('provider_skipped', {
        requestId: options.requestId,
        provider: provider.id,
        outcome: 'circuit_open',
      });
      continue;
    }
    const remaining = options.totalTimeoutMs - (now() - started);
    if (remaining < MIN_ATTEMPT_MS) break;
    const attemptStarted = now();
    try {
      const text = await provider.generate({
        system: SYSTEM_PROMPT,
        prompt,
        jsonSchema: spec.jsonSchema,
        maxOutputTokens: spec.maxOutputTokens,
        signal: AbortSignal.timeout(
          Math.min(provider.timeoutMs ?? options.providerTimeoutMs, remaining),
        ),
      });
      const validated = spec.outputSchema.safeParse(extractJsonObject(text));
      if (!validated.success) throw new ProviderError('Model output failed schema validation');
      const output = spec.postProcess(validated.data);
      if (output === null) throw new ProviderError('Model output had no usable content');
      options.breaker.reset(provider.id);
      options.logger.info('provider_ok', {
        requestId: options.requestId,
        task: request.task,
        provider: provider.id,
        ms: now() - attemptStarted,
        outcome: 'ok',
      });
      return { output, provider };
    } catch (error) {
      const failure =
        error instanceof SyntaxError
          ? new ProviderError('Model returned invalid JSON')
          : toProviderError(error);
      if (failure.isTransient) options.breaker.trip(provider.id);
      options.logger.warn('provider_failed', {
        requestId: options.requestId,
        task: request.task,
        provider: provider.id,
        ms: now() - attemptStarted,
        outcome: failure.message.slice(0, 80),
        ...(failure.status !== null ? { status: failure.status } : {}),
      });
    }
  }
  return null;
}
