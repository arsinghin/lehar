import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearAiCache } from './apiClient';
import { cx, slugify } from './util';

afterEach(() => {
  clearAiCache();
  vi.unstubAllGlobals();
});

describe('util', () => {
  it('joins class names and slugifies titles', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b');
    expect(slugify('Riya & Arjun’s Wedding!')).toBe('riya-arjun-s-wedding');
    expect(slugify('शादी')).toBe('lehar-plan');
  });
});
