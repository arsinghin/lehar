import { describe, expect, it } from 'vitest';

import { isAllowedOrigin, isJsonContentType, readBoundedBody } from './requestGuards';

describe('request guards', () => {
  const req = (headers: Record<string, string>, url = 'https://lehar.vercel.app/api/ai') =>
    new Request(url, { method: 'POST', headers, body: '{}' });

  it('allows same-origin and server-to-server requests', () => {
    expect(
      isAllowedOrigin(
        req({ origin: 'https://lehar.vercel.app', 'sec-fetch-site': 'same-origin' }),
        [],
      ),
    ).toBe(true);
    expect(isAllowedOrigin(req({}), [])).toBe(true);
    expect(isAllowedOrigin(req({ origin: 'https://x.example', host: 'x.example' }), [])).toBe(true);
  });

  it('blocks cross-site requests unless explicitly allowed', () => {
    expect(
      isAllowedOrigin(req({ origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }), []),
    ).toBe(false);
    expect(isAllowedOrigin(req({ origin: 'https://evil.example' }), [])).toBe(false);
    expect(isAllowedOrigin(req({ origin: 'null' }), [])).toBe(false);
    expect(
      isAllowedOrigin(req({ origin: 'https://partner.example', 'sec-fetch-site': 'cross-site' }), [
        'https://partner.example',
      ]),
    ).toBe(true);
  });

  it('checks the JSON content type', () => {
    expect(isJsonContentType(req({ 'content-type': 'application/json; charset=utf-8' }))).toBe(
      true,
    );
    expect(isJsonContentType(req({ 'content-type': 'text/plain' }))).toBe(false);
    expect(isJsonContentType(new Request('https://x', { method: 'POST' }))).toBe(false);
  });

  it('bounds the body by declared and actual size', async () => {
    expect(await readBoundedBody(new Request('https://x', { method: 'POST', body: 'ok' }))).toEqual(
      { ok: true, text: 'ok' },
    );
    expect(
      await readBoundedBody(new Request('https://x', { method: 'POST', body: 'é'.repeat(10) }), 15),
    ).toEqual({ ok: false });
    expect(
      await readBoundedBody(
        new Request('https://x', {
          method: 'POST',
          headers: { 'content-length': '99999' },
          body: 'x',
        }),
      ),
    ).toEqual({ ok: false });
  });
});
