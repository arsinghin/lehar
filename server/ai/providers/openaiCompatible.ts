/**
 * Shared client for OpenAI-compatible chat completions (OpenRouter and NVIDIA NIM), via plain fetch.
 *
 * Free endpoints differ from Gemini in ways handled here once:
 * - Many ignore response_format, so the JSON Schema is also written into the system prompt.
 * - Reasoning models can spend the whole token budget thinking, so callers add headroom and an empty
 *   answer with finish_reason "length" is reported as such.
 * - A timeout while the body is still streaming in is reported as a timeout, not as an empty answer.
 */
import * as z from 'zod/mini';

import { ProviderError, toProviderError } from './types.js';

/** Extra tokens for any reasoning the model still does, on top of the answer budget. */
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
  error: z.union([z.string(), z.object({ message: z.optional(z.string()) })]),
});

/** The provider's own error message, for classification only. It is never logged. */
export function errorMessageOf(body: unknown): string {
  const error = ErrorBodySchema.safeParse(body).data?.error;
  if (typeof error === 'string') return error;
  return error?.message ?? '';
}

export function systemWithSchema(system: string, jsonSchema: Record<string, unknown>): string {
  return `${system}\nThe JSON must match this JSON Schema:\n${JSON.stringify(jsonSchema)}`;
}

/** Some reasoning models put their thinking inline in <think> tags; only the answer is kept. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

export interface ChatCompletionCall {
  endpoint: string;
  apiKey: string;
  /** Provider name used in error messages, e.g. "OpenRouter". */
  label: string;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
  signal: AbortSignal;
  fetchImpl: typeof fetch;
  /** Maps an HTTP failure to a short, content-free reason for the logs. */
  describeError: (status: number, body: unknown) => string;
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

export async function postChatCompletion(call: ChatCompletionCall): Promise<string> {
  try {
    const response = await call.fetchImpl(call.endpoint, {
      method: 'POST',
      signal: call.signal,
      headers: {
        Authorization: `Bearer ${call.apiKey}`,
        'Content-Type': 'application/json',
        ...call.headers,
      },
      body: JSON.stringify(call.body),
    });
    const body = await readJson(response);
    if (!response.ok) {
      throw new ProviderError(call.describeError(response.status, body), response.status);
    }
    // Gateways can answer 200 with an error object when the upstream model fails.
    if (ErrorBodySchema.safeParse(body).success) {
      throw new ProviderError(`${call.label} upstream error`, 502);
    }
    const parsed = CompletionSchema.safeParse(body);
    const choice = parsed.success ? parsed.data.choices[0] : undefined;
    const content = stripThinking(choice?.message.content ?? '');
    if (!content) {
      throw new ProviderError(
        choice?.finish_reason === 'length'
          ? `${call.label} ran out of tokens before answering`
          : `Empty response from ${call.label}`,
      );
    }
    return content;
  } catch (error) {
    throw toProviderError(error);
  }
}
