import { afterEach, describe, expect, it, vi } from 'vitest';

import { IDEA, ideasRequest, ok, respond } from '../../tests/aiResponses';
import { AiClientError, clearAiCache, requestAi } from './apiClient';

afterEach(() => {
  clearAiCache();
  vi.unstubAllGlobals();
});

describe('requestAi', () => {
  it('posts JSON same-origin and validates the response', async () => {
    const fetchImpl = respond(200, ok('ideas', { ideas: [IDEA] }));
    const result = await requestAi(ideasRequest, fetchImpl);
    expect(result).toEqual({
      data: { ideas: [IDEA] },
      source: 'gemini',
      model: 'gemini-3.8-flash',
    });
    const [url, init] = (fetchImpl.mock.calls[0] ?? []) as unknown as [string, RequestInit];
    expect(url).toBe('/api/ai');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
  });

  it('caches AI answers and de-duplicates concurrent requests', async () => {
    const fetchImpl = respond(200, ok('ideas', { ideas: [IDEA] }));
    await Promise.all([requestAi(ideasRequest, fetchImpl), requestAi(ideasRequest, fetchImpl)]);
    await requestAi(ideasRequest, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not cache rule-based answers', async () => {
    const fetchImpl = respond(200, ok('ideas', { ideas: [IDEA] }, 'rules'));
    await requestAi(ideasRequest, fetchImpl);
    await requestAi(ideasRequest, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([
    [429, 'rate_limited'],
    [422, 'input_rejected'],
    [400, 'invalid_request'],
    [500, 'server_error'],
    [404, 'unavailable'],
  ] as const)('maps HTTP %i to %s', async (status, code) => {
    const fetchImpl = respond(
      status,
      { ok: false, error: { code: 'x', message: 'Nope' } },
      { 'retry-after': '30' },
    );
    await expect(requestAi(ideasRequest, fetchImpl)).rejects.toMatchObject({
      code,
      message: 'Nope',
    });
  });

  it('reads Retry-After and tolerates non-JSON error bodies', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('<html>', { status: 429, headers: { 'retry-after': '12' } })),
    );
    await expect(requestAi(ideasRequest, fetchImpl)).rejects.toMatchObject({
      code: 'rate_limited',
      retryAfterSeconds: 12,
    });
  });

  it('treats network failures and malformed answers as errors', async () => {
    await expect(
      requestAi(
        ideasRequest,
        vi.fn(() => Promise.reject(new TypeError('offline'))),
      ),
    ).rejects.toMatchObject({ code: 'unavailable' });
    await expect(
      requestAi(ideasRequest, respond(200, ok('ideas', { ideas: [{ title: 1 }] }))),
    ).rejects.toMatchObject({ code: 'server_error' });
    await expect(
      requestAi(ideasRequest, respond(200, ok('parseChange', {}))),
    ).rejects.toBeInstanceOf(AiClientError);
  });
});
