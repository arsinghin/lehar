/** Provider abstraction: every model backend turns (system, prompt, schema) into raw JSON text. */
import type { AiSource } from '../../../src/core/constants/enums.js';

export interface GenerateInput {
  system: string;
  prompt: string;
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
  signal: AbortSignal;
}

export interface AiProvider {
  /** Stable id used for circuit breaking and logs, e.g. "gemini:gemini-3.8-flash". */
  id: string;
  source: Exclude<AiSource, 'rules'>;
  model: string;
  /** Per-attempt timeout override. Free OpenRouter endpoints are slower than Gemini. */
  timeoutMs?: number;
  generate(input: GenerateInput): Promise<string>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'ProviderError';
  }

  /** Quota, overload and timeout errors trip the circuit breaker. Bad output does not. */
  get isTransient(): boolean {
    return (
      this.status === 408 || this.status === 429 || (this.status !== null && this.status >= 500)
    );
  }
}

export function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return new ProviderError('Provider timed out', 408);
  }
  const status =
    typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : NaN;
  const message = error instanceof Error ? error.message : 'Provider failed';
  return new ProviderError(message.slice(0, 200), Number.isFinite(status) ? status : null);
}
