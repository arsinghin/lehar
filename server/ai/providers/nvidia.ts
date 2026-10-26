/**
 * NVIDIA NIM fallback (build.nvidia.com free endpoints, OpenAI-compatible), tried after OpenRouter.
 *
 * Nemotron models switch thinking on and off through the chat template. It is turned off here because
 * the tasks are short JSON answers. NIM is not sent response_format; the schema is in the prompt.
 */
import {
  errorMessageOf,
  postChatCompletion,
  REASONING_HEADROOM_TOKENS,
  systemWithSchema,
} from './openaiCompatible.js';
import type { AiProvider, GenerateInput } from './types.js';

export const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

export interface NvidiaOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** A short, content-free reason for logs. */
export function describeNvidiaError(status: number, body: unknown): string {
  if (status === 401 || status === 403) return `NVIDIA ${String(status)}: invalid NVIDIA_API_KEY`;
  if (status === 402) return 'NVIDIA 402: no free credits left on this key';
  if (status === 404) return 'NVIDIA 404: model not found, check NVIDIA_MODELS';
  if (status === 429) return 'NVIDIA 429: free endpoint rate limit';
  if (status === 400 && /chat_template|enable_thinking/i.test(errorMessageOf(body))) {
    return 'NVIDIA 400: model does not accept the thinking switch';
  }
  return `NVIDIA HTTP ${String(status)}`;
}

export function createNvidiaProvider({
  apiKey,
  model,
  timeoutMs,
  fetchImpl = fetch,
}: NvidiaOptions): AiProvider {
  return {
    id: `nvidia:${model}`,
    source: 'nvidia',
    model,
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    generate: ({ system, prompt, jsonSchema, maxOutputTokens, signal }: GenerateInput) =>
      postChatCompletion({
        endpoint: NVIDIA_ENDPOINT,
        apiKey,
        label: 'NVIDIA',
        signal,
        fetchImpl,
        describeError: describeNvidiaError,
        body: {
          model,
          messages: [
            { role: 'system', content: systemWithSchema(system, jsonSchema) },
            { role: 'user', content: prompt },
          ],
          chat_template_kwargs: { enable_thinking: false },
          max_tokens: maxOutputTokens + REASONING_HEADROOM_TOKENS,
          temperature: 0.4,
          top_p: 0.95,
          stream: false,
        },
      }),
  };
}
