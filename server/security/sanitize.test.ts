import { describe, expect, it } from 'vitest';

import { sanitizeModelText } from './sanitize';

describe('sanitizeModelText', () => {
  it('removes URLs, emails, phones, prices, tags and control characters', () => {
    const dirty =
      'Book <b>now</b> at https://x.example or www.y.in, mail a@b.co, call +91 98765 43210, only ₹5,000 or 2 lakh!\u202E';
    expect(sanitizeModelText(dirty, 500)).toBe('Book now at or mail, call, only or!');
  });

  it('truncates to the limit', () => {
    expect(sanitizeModelText('a'.repeat(50), 10)).toHaveLength(10);
  });
});
