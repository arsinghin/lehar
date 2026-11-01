/**
 * Provider factory for OpenAI-compatible chat completions (OpenRouter and NVIDIA NIM), via plain fetch.
 *
 * Free endpoints differ from Gemini in ways handled here once:
 * - Many ignore response_format, so the JSON Schema is also written into the system prompt.
 * - Reasoning models can spend the whole token budget thinking, so extra headroom is added, and an
 *   empty answer with finish_reason "length" is reported as such.
 * - A timeout while the body is still streaming in is reported as a timeout, not as an empty answer.
 */
import * as z from 'zod/mini';

import { ProviderError, toProviderError, type AiProvider, type GenerateInput } from './types.js';

/** Extra tokens for any reasoning the model still does, on top of the answer budget. */
export const REASONING_HEADROOM_TOKENS = 1_500;
/** Low enough for consistent JSON, high enough for varied ideas. */
export const TEMPERATURE = 0.4;

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
  error: z.union([z.string(), z.object({ message: z.optional(z.string()) })]),
});

/** The provider's own error message, for classification only. It is never logged. */
export function errorMessageOf(body: unknown): string {
  const error = ErrorBodySchema.safeParse(body).data?.error;
  if (typeof error === 'string') return error;
  return error?.message ?? '';
}

/** The system prompt with the JSON Schema appended, for endpoints that ignore response_format. */
export function systemWithSchema(system: string, jsonSchema: Record<string, unknown>): string {
  return `${system}\nThe JSON must match this JSON Schema:\n${JSON.stringify(jsonSchema)}`;
}

/** Some reasoning models put their thinking inline in <think> tags; only the answer is kept. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

export interface OpenAiCompatibleConfig {
  /** Which provider family answered, shown to the host as the suggestion's source. */
  source: AiProvider['source'];
  /** Provider name used in error messages, e.g. "OpenRouter". */
  label: string;
  endpoint: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Provider-specific request fields (reasoning switches, response_format, sampling). */
  extraBody?: (input: GenerateInput) => Record<string, unknown>;
  /** Maps an HTTP failure to a short, content-free reason for the logs. */
  describeError: (status: number, body: unknown) => string;
  fetchImpl?: typeof fetch;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    // Only malformed JSON means "no usable body". An abort (timeout) must surface as a timeout.
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

/** The answer text from a completion body, or a classified error. */
function contentOf(body: unknown, label: string): string {
  // Gateways can answer 200 with an error object when the upstream model fails.
  if (ErrorBodySchema.safeParse(body).success) {
    throw new ProviderError(`${label} upstream error`, 502);
  }
  const parsed = CompletionSchema.safeParse(body);
  const choice = parsed.success ? parsed.data.choices[0] : undefined;
  const content = stripThinking(choice?.message.content ?? '');
  if (content) return content;
  throw new ProviderError(
    choice?.finish_reason === 'length'
      ? `${label} ran out of tokens before answering`
      : `Empty response from ${label}`,
  );
}

function requestBody(
  config: OpenAiCompatibleConfig,
  input: GenerateInput,
): Record<string, unknown> {
  return {
    model: config.model,
    messages: [
      { role: 'system', content: systemWithSchema(input.system, input.jsonSchema) },
      { role: 'user', content: input.prompt },
    ],
    max_tokens: input.maxOutputTokens + REASONING_HEADROOM_TOKENS,
    temperature: TEMPERATURE,
    ...config.extraBody?.(input),
  };
}

/** A provider for any OpenAI-compatible chat completions endpoint. */
export function createOpenAiCompatibleProvider(config: OpenAiCompatibleConfig): AiProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  return {
    id: `${config.source}:${config.model}`,
    source: config.source,
    model: config.model,
    ...(config.timeoutMs !== undefined ? { timeoutMs: config.timeoutMs } : {}),
    async generate(input) {
      try {
        const response = await fetchImpl(config.endpoint, {
          method: 'POST',
          signal: input.signal,
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            ...config.headers,
          },
          body: JSON.stringify(requestBody(config, input)),
        });
        const body = await readJson(response);
        if (!response.ok) {
          throw new ProviderError(config.describeError(response.status, body), response.status);
        }
        return contentOf(body, config.label);
      } catch (error) {
        throw toProviderError(error);
      }
    },
  };
}
