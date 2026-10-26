/**
 * OpenRouter fallback, restricted to free models by config.
 *
 * The default is nvidia/nemotron-3.5-lightning:free with reasoning off: the tasks are short JSON
 * answers, so thinking only adds latency. Models that require reasoning (e.g. gpt-oss) need
 * OPENROUTER_REASONING=low, which sends a low effort instead.
 */
import type { OpenRouterReasoning } from '../../config.js';
import {
  errorMessageOf,
  postChatCompletion,
  REASONING_HEADROOM_TOKENS,
  systemWithSchema,
} from './openaiCompatible.js';
import type { AiProvider, GenerateInput } from './types.js';

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
  if (status === 401) return 'OpenRouter 401: invalid OPENROUTER_API_KEY';
  if (status === 402) return 'OpenRouter 402: needs credits, use :free models only';
  if (status === 404 && /data policy|privacy/i.test(message)) {
    return 'OpenRouter 404: privacy settings block free models';
  }
  if (status === 404) return 'OpenRouter 404: model not found or unavailable';
  if (status === 429) return 'OpenRouter 429: free-model rate limit';
  return `OpenRouter HTTP ${String(status)}`;
}

export function createOpenRouterProvider({
  apiKey,
  model,
  reasoning = 'off',
  timeoutMs,
  fetchImpl = fetch,
}: OpenRouterOptions): AiProvider {
  return {
    id: `openrouter:${model}`,
    source: 'openrouter',
    model,
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    generate: ({ system, prompt, jsonSchema, maxOutputTokens, signal }: GenerateInput) =>
      postChatCompletion({
        endpoint: OPENROUTER_ENDPOINT,
        apiKey,
        label: 'OpenRouter',
        headers: { 'X-Title': 'Lehar' },
        signal,
        fetchImpl,
        describeError: describeOpenRouterError,
        body: {
          model,
          messages: [
            { role: 'system', content: systemWithSchema(system, jsonSchema) },
            { role: 'user', content: prompt },
          ],
          // Used by models that support it; OpenRouter drops it for models that do not.
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'lehar_response', strict: false, schema: jsonSchema },
          },
          reasoning: reasoning === 'off' ? { enabled: false } : { effort: 'low', exclude: true },
          max_tokens: maxOutputTokens + REASONING_HEADROOM_TOKENS,
          temperature: 0.4,
        },
      }),
  };
}
