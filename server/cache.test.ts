import { describe, expect, it } from 'vitest';

import { cacheKey, stableStringify, TtlCache } from './cache';

describe('cache', () => {
  it('expires entries and evicts least-recently used', () => {
    let now = 0;
    const cache = new TtlCache<number>(2, 100, () => now);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.size).toBe(2);
    now = 100;
    expect(cache.get('a')).toBeUndefined();
  });

  it('hashes semantically equal payloads identically', () => {
    expect(stableStringify({ b: [1, { d: 1, c: 2 }], a: undefined, z: null })).toBe(
      '{"b":[1,{"c":2,"d":1}],"z":null}',
    );
    expect(cacheKey({ x: 1, y: 2 })).toBe(cacheKey({ y: 2, x: 1 }));
    expect(cacheKey({ x: 1 })).toMatch(/^[a-f0-9]{64}$/);
    expect(stableStringify(undefined)).toBe('null');
  });
});
