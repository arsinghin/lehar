import { describe, expect, it } from 'vitest';

import { providerInput } from '../../../tests/server/providerTesting';
import { errorMessageOf, stripThinking } from './openaiCompatible';
import { createOpenRouterProvider } from './openrouter';

describe('OpenAI-compatible provider', () => {
  it('the shared client maps upstream errors, empty and truncated answers, and timeouts', async () => {
    const respond = (body: string | (() => Promise<unknown>), status = 200) =>
      createOpenRouterProvider({
        apiKey: 'k',
        model: 'm:free',
        fetchImpl: () =>
          Promise.resolve(
            typeof body === 'string'
              ? new Response(body, { status })
              : ({ ok: true, status, json: body } as unknown as Response),
          ),
      }).generate(providerInput());
    await expect(
      respond(JSON.stringify({ error: { message: 'No endpoints… data policy' } }), 404),
    ).rejects.toMatchObject({ status: 404, message: expect.stringMatching(/privacy/) as string });
    await expect(
      respond(JSON.stringify({ error: { message: 'upstream down' } })),
    ).rejects.toMatchObject({ status: 502, isTransient: true });
    await expect(
      respond(JSON.stringify({ choices: [{ message: { content: '' }, finish_reason: 'length' }] })),
    ).rejects.toThrow(/ran out of tokens/);
    await expect(
      respond(JSON.stringify({ choices: [{ message: { content: null } }] })),
    ).rejects.toThrow(/Empty/);
    await expect(respond('<html>')).rejects.toThrow(/Empty/);
    // The deadline can fire while the body is still arriving: that is a timeout, not an empty answer.
    await expect(
      respond(() => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError'))),
    ).rejects.toMatchObject({ status: 408, message: 'Provider timed out' });
  });

  it('strips inline thinking and accepts plain-string error bodies', () => {
    expect(stripThinking('<think>a\nb</think>\n{"x":1}')).toBe('{"x":1}');
    expect(errorMessageOf({ error: 'plain' })).toBe('plain');
    expect(errorMessageOf(null)).toBe('');
  });
});
