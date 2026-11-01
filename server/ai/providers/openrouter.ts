/**
 * OpenRouter fallback, restricted to free models by config.
 *
 * The default is nvidia/nemotron-3.5-lightning:free with reasoning off: the tasks are short JSON
 * answers, so thinking only adds latency. Models that require reasoning (e.g. gpt-oss) need
 * OPENROUTER_REASONING=low, which sends a low effort instead.
 */
import type { OpenRouterReasoning } from '../../config.js';
import { createOpenAiCompatibleProvider, errorMessageOf } from './openaiCompatible.js';
import type { AiProvider } from './types.js';

export const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export interface OpenRouterOptions {
  apiKey: string;
  model: string;
  reasoning?: OpenRouterReasoning;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** A short, content-free reason for logs, so a failed deploy can be diagnosed from the Vercel logs. */
export function describeOpenRouterError(status: number, body: unknown): string {
  const message = errorMessageOf(body);
  if (status === 400 && /reasoning/i.test(message)) {
    return 'OpenRouter 400: model needs reasoning, set OPENROUTER_REASONING=low';
  }
  if (status === 404 && /data policy|privacy/i.test(message)) {
    return 'OpenRouter 404: privacy settings block free models';
  }
  const known: Record<number, string> = {
    401: 'OpenRouter 401: invalid OPENROUTER_API_KEY',
    402: 'OpenRouter 402: needs credits, use :free models only',
    404: 'OpenRouter 404: model not found or unavailable',
    429: 'OpenRouter 429: free-model rate limit',
  };
  return known[status] ?? `OpenRouter HTTP ${String(status)}`;
}

/** An OpenRouter provider for one free model. */
export function createOpenRouterProvider({
  reasoning = 'off',
  ...options
}: OpenRouterOptions): AiProvider {
  return createOpenAiCompatibleProvider({
    ...options,
    source: 'openrouter',
    label: 'OpenRouter',
    endpoint: OPENROUTER_ENDPOINT,
    headers: { 'X-Title': 'Lehar' },
    describeError: describeOpenRouterError,
    extraBody: ({ jsonSchema }) => ({
      // Used by models that support it; OpenRouter drops it for models that do not.
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'lehar_response', strict: false, schema: jsonSchema },
      },
      reasoning: reasoning === 'off' ? { enabled: false } : { effort: 'low', exclude: true },
    }),
  });
}
