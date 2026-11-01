/**
 * NVIDIA NIM fallback (build.nvidia.com free endpoints, OpenAI-compatible), tried after OpenRouter.
 *
 * Nemotron models switch thinking on and off through the chat template. It is turned off here because
 * the tasks are short JSON answers. NIM is not sent response_format; the schema is in the prompt.
 */
import { createOpenAiCompatibleProvider, errorMessageOf } from './openaiCompatible.js';
import type { AiProvider } from './types.js';

export const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

/** NVIDIA's recommended nucleus sampling for Nemotron. */
const TOP_P = 0.95;

export interface NvidiaOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** A short, content-free reason for logs. */
export function describeNvidiaError(status: number, body: unknown): string {
  if (status === 400 && /chat_template|enable_thinking/i.test(errorMessageOf(body))) {
    return 'NVIDIA 400: model does not accept the thinking switch';
  }
  const known: Record<number, string> = {
    401: 'NVIDIA 401: invalid NVIDIA_API_KEY',
    402: 'NVIDIA 402: no free credits left on this key',
    403: 'NVIDIA 403: invalid NVIDIA_API_KEY',
    404: 'NVIDIA 404: model not found, check NVIDIA_MODELS',
    429: 'NVIDIA 429: free endpoint rate limit',
  };
  return known[status] ?? `NVIDIA HTTP ${String(status)}`;
}

/** An NVIDIA NIM provider with thinking switched off. */
export function createNvidiaProvider(options: NvidiaOptions): AiProvider {
  return createOpenAiCompatibleProvider({
    ...options,
    source: 'nvidia',
    label: 'NVIDIA',
    endpoint: NVIDIA_ENDPOINT,
    describeError: describeNvidiaError,
    extraBody: () => ({
      chat_template_kwargs: { enable_thinking: false },
      top_p: TOP_P,
      stream: false,
    }),
  });
}
