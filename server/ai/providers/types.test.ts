import { describe, expect, it } from 'vitest';

import { ProviderError, toProviderError } from './types';

describe('toProviderError', () => {
  it('classifies errors', () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    expect(toProviderError(abort)).toMatchObject({ status: 408, isTransient: true });
    expect(toProviderError('weird')).toMatchObject({ status: null, isTransient: false });
    expect(new ProviderError('x', 400).isTransient).toBe(false);
  });
});
