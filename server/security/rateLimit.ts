/**
 * Per-client fixed-window rate limiting (per minute and per day), in memory per warm instance.
 * This protects the free AI quota from abuse. A distributed limiter (for example Vercel KV) would be
 * the next step at higher scale. The trade-off is recorded in docs/DECISIONS.md.
 */
import { LruMap } from '../../src/core/lruMap.js';

export interface RateLimitOptions {
  perMinute: number;
  perDay: number;
  maxKeys?: number;
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

interface Window {
  minuteStart: number;
  minuteCount: number;
  dayStart: number;
  dayCount: number;
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
/** Clients remembered per instance; the least recently seen are forgotten first. */
const DEFAULT_MAX_KEYS = 5_000;

export class RateLimiter {
  private readonly windows: LruMap<string, Window>;

  constructor(
    private readonly options: RateLimitOptions,
    private readonly now: () => number = Date.now,
  ) {
    this.windows = new LruMap(options.maxKeys ?? DEFAULT_MAX_KEYS);
  }

  check(key: string): RateLimitResult {
    const now = this.now();
    const window = this.windows.get(key) ?? {
      minuteStart: now,
      minuteCount: 0,
      dayStart: now,
      dayCount: 0,
    };
    if (now - window.minuteStart >= MINUTE_MS) {
      window.minuteStart = now;
      window.minuteCount = 0;
    }
    if (now - window.dayStart >= DAY_MS) {
      window.dayStart = now;
      window.dayCount = 0;
    }
    this.windows.set(key, window);

    if (window.dayCount >= this.options.perDay) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((window.dayStart + DAY_MS - now) / 1000),
      };
    }
    if (window.minuteCount >= this.options.perMinute) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((window.minuteStart + MINUTE_MS - now) / 1000),
      };
    }
    window.minuteCount += 1;
    window.dayCount += 1;
    return { allowed: true };
  }
}

/** Best-effort client key. Vercel sets x-forwarded-for / x-real-ip on every request. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'anonymous';
}
