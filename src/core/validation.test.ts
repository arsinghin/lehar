import { describe, expect, it } from 'vitest';

import { checkBudget, checkGuests, checkQuoteAmount, parseWholeNumber } from './validation';

describe('parseWholeNumber', () => {
  it.each([
    [' 1,250 ', undefined, 1250],
    ['0', undefined, 0],
    ['-3', undefined, null],
    ['2.5', undefined, null],
    ['many', undefined, null],
    ['120', 100, null],
    ['100', 100, 100],
  ])('parseWholeNumber(%j, %j) = %j', (text, max, expected) => {
    expect(parseWholeNumber(text, max)).toBe(expected);
  });
});

describe('checkGuests', () => {
  it('accepts Indian digit grouping and rejects fractions and out-of-range counts', () => {
    expect(checkGuests('1,200')).toEqual({ ok: true, value: 1200 });
    expect(checkGuests('2.5')).toMatchObject({ ok: false, message: /whole number/ });
    expect(checkGuests('0')).toMatchObject({ ok: false, message: /between 1 and 5,000/ });
    expect(checkGuests('5001')).toMatchObject({ ok: false });
  });
});

describe('checkBudget', () => {
  it('accepts lakh and rupee formats and enforces the supported range', () => {
    expect(checkBudget('8 lakh')).toEqual({ ok: true, value: 800_000 });
    expect(checkBudget('₹12,00,000')).toEqual({ ok: true, value: 1_200_000 });
    expect(checkBudget('lots')).toMatchObject({ ok: false, message: /for example/ });
    expect(checkBudget('500')).toMatchObject({ ok: false, message: /between/ });
  });
});

describe('checkQuoteAmount', () => {
  it('accepts any positive amount up to the largest budget', () => {
    expect(checkQuoteAmount('2.3 lakh')).toEqual({ ok: true, value: 230_000 });
    expect(checkQuoteAmount('0')).toMatchObject({ ok: false });
    expect(checkQuoteAmount('')).toMatchObject({ ok: false, message: /quoted total/ });
  });
});
