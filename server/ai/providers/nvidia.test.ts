import { describe, expect, it } from 'vitest';

import { okFetch, providerInput, sentBody } from '../../../tests/server/providerTesting';
import { createNvidiaProvider, describeNvidiaError, NVIDIA_ENDPOINT } from './nvidia';
import { REASONING_HEADROOM_TOKENS } from './openaiCompatible';

describe('createNvidiaProvider', () => {
  it('NVIDIA NIM posts to the catalog endpoint with thinking off and the schema in the prompt', async () => {
    const fetchImpl = okFetch('<think>planning</think>{"ok":true}');
    const provider = createNvidiaProvider({
      apiKey: 'nv-key',
      model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
      timeoutMs: 22_000,
      fetchImpl,
    });
    expect(provider).toMatchObject({
      id: 'nvidia:nvidia/nemotron-3.5-lightning-30b-a3b',
      source: 'nvidia',
    });
    expect(await provider.generate(providerInput())).toBe('{"ok":true}');
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(NVIDIA_ENDPOINT);
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer nv-key');
    const body = sentBody(fetchImpl);
    expect(body).toMatchObject({
      model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
      chat_template_kwargs: { enable_thinking: false },
      max_tokens: 50 + REASONING_HEADROOM_TOKENS,
      stream: false,
    });
    expect(body).not.toHaveProperty('response_format');
    expect(body.messages[0]?.content).toContain('{"type":"object"}');
  });

  it('NVIDIA NIM explains common failures', async () => {
    expect(describeNvidiaError(401, null)).toMatch(/NVIDIA_API_KEY/);
    expect(describeNvidiaError(403, null)).toMatch(/NVIDIA_API_KEY/);
    expect(describeNvidiaError(402, null)).toMatch(/credits/);
    expect(describeNvidiaError(404, null)).toMatch(/NVIDIA_MODELS/);
    expect(describeNvidiaError(429, null)).toMatch(/rate limit/);
    expect(describeNvidiaError(400, { error: 'unknown chat_template_kwargs' })).toMatch(/thinking/);
    expect(describeNvidiaError(500, null)).toBe('NVIDIA HTTP 500');
    const failing = createNvidiaProvider({
      apiKey: 'k',
      model: 'nvidia/x',
      fetchImpl: () => Promise.resolve(new Response('{}', { status: 429 })),
    });
    await expect(failing.generate(providerInput())).rejects.toMatchObject({
      status: 429,
      isTransient: true,
    });
  });
});
