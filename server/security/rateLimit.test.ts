import { describe, expect, it } from 'vitest';

import { clientKey, RateLimiter } from './rateLimit';

describe('rate limiter', () => {
  it('enforces per-minute and per-day windows, then resets', () => {
    let now = 0;
    const limiter = new RateLimiter({ perMinute: 2, perDay: 3 }, () => now);
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(true);
    const blocked = limiter.check('a');
    expect(blocked).toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(limiter.check('b').allowed).toBe(true);
    now = 60_000;
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a')).toMatchObject({ allowed: false });
    now = 86_400_000;
    expect(limiter.check('a').allowed).toBe(true);
  });

  it('evicts the oldest keys beyond the cap', () => {
    const limiter = new RateLimiter({ perMinute: 1, perDay: 1, maxKeys: 2 });
    limiter.check('a');
    limiter.check('b');
    limiter.check('c');
    expect(limiter.check('a').allowed).toBe(true);
  });

  it('derives the client key from proxy headers', () => {
    expect(
      clientKey(new Request('https://x', { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } })),
    ).toBe('1.2.3.4');
    expect(clientKey(new Request('https://x', { headers: { 'x-real-ip': '5.6.7.8' } }))).toBe(
      '5.6.7.8',
    );
    expect(clientKey(new Request('https://x'))).toBe('anonymous');
  });
});
