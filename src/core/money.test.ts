import { describe, expect, it } from 'vitest';

import { formatInr, formatNumber, formatSignedInr, parseInrAmount, roundTo } from './money';

describe('formatInr', () => {
  it('uses Indian digit grouping', () => {
    expect(formatInr(800_000)).toBe('₹8,00,000');
    expect(formatInr(12_345_678)).toBe('₹1,23,45,678');
    expect(formatInr(999.6)).toBe('₹1,000');
  });

  it('formats signed deltas with a true minus sign', () => {
    expect(formatSignedInr(55_000)).toBe('+₹55,000');
    expect(formatSignedInr(-5_000)).toBe('−₹5,000');
    expect(formatSignedInr(0.2)).toBe('₹0');
  });

  it('formats plain numbers', () => {
    expect(formatNumber(1250)).toBe('1,250');
  });
});

describe('parseInrAmount', () => {
  it.each([
    ['8 lakh', 800_000],
    ['8 lakhs', 800_000],
    ['7.5 lakh', 750_000],
    ['1.5L', 150_000],
    ['₹7,00,000', 700_000],
    ['Rs. 45000', 45_000],
    ['INR 2,50,000', 250_000],
    ['70k', 70_000],
    ['2 thousand', 2_000],
    ['1.2 crore', 12_000_000],
    ['3 cr', 30_000_000],
    ['5 lacs', 500_000],
    ['800000', 800_000],
  ])('parses "%s"', (text, expected) => {
    expect(parseInrAmount(text)).toBe(expected);
  });

  it('returns null when there is no amount', () => {
    expect(parseInrAmount('a bit less')).toBeNull();
    expect(parseInrAmount('')).toBeNull();
  });
});

describe('roundTo', () => {
  it('rounds to the step', () => {
    expect(roundTo(1234, 100)).toBe(1200);
    expect(roundTo(1250, 100)).toBe(1300);
  });
});
