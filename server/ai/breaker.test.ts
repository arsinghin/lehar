import { describe, expect, it } from 'vitest';

import { CircuitBreaker } from './breaker';

describe('CircuitBreaker', () => {
  it('re-closes after the cooldown and on reset', () => {
    let now = 0;
    const breaker = new CircuitBreaker(1000, () => now);
    breaker.trip('x');
    expect(breaker.isOpen('x')).toBe(true);
    now = 1000;
    expect(breaker.isOpen('x')).toBe(false);
    breaker.trip('x');
    breaker.reset('x');
    expect(breaker.isOpen('x')).toBe(false);
  });
});
