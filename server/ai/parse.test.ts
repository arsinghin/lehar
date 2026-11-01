import { describe, expect, it } from 'vitest';

import { extractJsonObject } from './parse';

describe('extractJsonObject', () => {
  it('extracts JSON from fenced or chatty output', () => {
    expect(extractJsonObject('Sure! ```json\n{"a":{"b":1}}\n```')).toEqual({ a: { b: 1 } });
    expect(() => extractJsonObject('no json here')).toThrow(SyntaxError);
  });
});
