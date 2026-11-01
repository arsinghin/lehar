import { describe, expect, it } from 'vitest';

import { LruMap } from './lruMap';

describe('LruMap', () => {
  it('forgets the least recently used entry when full', () => {
    const map = new LruMap<string, number>(2);
    map.set('a', 1);
    map.set('b', 2);
    expect(map.get('a')).toBe(1); // "a" is now the most recent
    map.set('c', 3);
    expect(map.get('b')).toBeUndefined();
    expect(map.get('a')).toBe(1);
    expect(map.size).toBe(2);
  });

  it('replaces existing keys without growing, and supports delete and clear', () => {
    const map = new LruMap<string, number>(2);
    map.set('a', 1);
    map.set('a', 2);
    expect(map.size).toBe(1);
    expect(map.get('a')).toBe(2);
    map.delete('a');
    expect(map.get('a')).toBeUndefined();
    map.set('b', 1);
    map.clear();
    expect(map.size).toBe(0);
  });
});
