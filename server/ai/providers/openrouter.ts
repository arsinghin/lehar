/**
 * OpenRouter fallback (OpenAI-compatible chat completions), restricted to free models by config.
 * It is called with plain fetch, so there is no extra dependency.
 *
 * Free models need three adjustments that Gemini does not:
 * - Many are reasoning models (e.g. gpt-oss), and reasoning tokens count against max_tokens. Reasoning
 *   is set to low effort and extra headroom is added, or the model can run out before it answers.
 * - Some free endpoints ignore response_format, so the JSON Schema is also given in the prompt.
 * - Free endpoints are slower, so this provider gets a longer per-attempt timeout (see config).
 */
import * as z from 'zod/mini';

import { ProviderError, toProviderError, type AiProvider, type GenerateInput } from './types.js';

export const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/** Extra tokens for the model's reasoning, on top of the answer budget. Free models cost nothing. */
export const REASONING_HEADROOM_TOKENS = 1_500;

const CompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.nullable(z.optional(z.string())) }),
        finish_reason: z.nullable(z.optional(z.string())),
      }),
    )
    .check(z.minLength(1)),
});

const ErrorBodySchema = z.object({
  error: z.object({ message: z.optional(z.string()) }),
});

export interface OpenRouterOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * A short, content-free reason for logs, so a failed deploy can be diagnosed from the Vercel logs.
 * OpenRouter's own message is only inspected, never logged, because it can echo request details.
 */
export function describeOpenRouterError(status: number, body: unknown): string {
  const message = ErrorBodySchema.safeParse(body).data?.error.message ?? '';
  if (status === 401) return 'OpenRouter 401: invalid OPENROUTER_API_KEY';
  if (status === 402) return 'OpenRouter 402: needs credits, use :free models only';
  if (status === 404 && /data policy|privacy/i.test(message)) {
    return 'OpenRouter 404: privacy settings block free models';
  }
  if (status === 404) return 'OpenRouter 404: model not found or unavailable';
  if (status === 429) return 'OpenRouter 429: free-model rate limit';
  return `OpenRouter HTTP ${String(status)}`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createOpenRouterProvider({
  apiKey,
  model,
  timeoutMs,
  fetchImpl = fetch,
}: OpenRouterOptions): AiProvider {
  return {
    id: `openrouter:${model}`,
    source: 'openrouter',
    model,
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    async generate({
      system,
      prompt,
      jsonSchema,
      maxOutputTokens,
      signal,
    }: GenerateInput): Promise<string> {
      try {
        const response = await fetchImpl(OPENROUTER_ENDPOINT, {
          method: 'POST',
          signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'X-Title': 'Lehar',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: `${system}\nThe JSON must match this JSON Schema:\n${JSON.stringify(jsonSchema)}`,
              },
              { role: 'user', content: prompt },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'lehar_response', strict: false, schema: jsonSchema },
            },
            reasoning: { effort: 'low', exclude: true },
            max_tokens: maxOutputTokens + REASONING_HEADROOM_TOKENS,
            temperature: 0.4,
          }),
        });
        const body = await readJson(response);
        if (!response.ok) {
          throw new ProviderError(describeOpenRouterError(response.status, body), response.status);
        }
        // OpenRouter can answer 200 with an error object when the upstream provider fails.
        if (ErrorBodySchema.safeParse(body).success) {
          throw new ProviderError('OpenRouter upstream error', 502);
        }
        const parsed = CompletionSchema.safeParse(body);
        const choice = parsed.success ? parsed.data.choices[0] : undefined;
        const content = choice?.message.content?.trim();
        if (!content) {
          throw new ProviderError(
            choice?.finish_reason === 'length'
              ? 'OpenRouter ran out of tokens before answering'
              : 'Empty response from OpenRouter',
          );
        }
        return content;
      } catch (error) {
        throw toProviderError(error);
      }
    },
  };
}
