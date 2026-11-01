/**
 * A small TTL + LRU cache. Identical requests (the same event context) are answered from memory on a
 * warm instance, which saves free-tier quota and latency.
 */
import { createHash } from 'node:crypto';

import { LruMap } from '../src/core/lruMap.js';

export class TtlCache<V> {
  private readonly entries: LruMap<string, { value: V; expires: number }>;

  constructor(
    maxEntries: number,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {
    this.entries = new LruMap(maxEntries);
  }

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V): void {
    this.entries.set(key, { value, expires: this.now() + this.ttlMs });
  }

  get size(): number {
    return this.entries.size;
  }
}

/** JSON with sorted keys, so semantically equal payloads hash the same. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return value === undefined ? 'null' : JSON.stringify(value);
}

/** A SHA-256 key for a payload, stable regardless of property order. */
export function cacheKey(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}
