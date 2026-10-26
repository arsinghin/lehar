import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  addDays,
  diffDays,
  formatDate,
  formatDateLong,
  fromDayNumber,
  isValidIsoDate,
  isoFromParts,
  minDate,
  monthOf,
  relativeDays,
  toDayNumber,
  todayIso,
} from './dates';

describe('isValidIsoDate', () => {
  it.each(['2026-10-26', '2028-02-29', '2027-12-31'])('accepts %s', (value) => {
    expect(isValidIsoDate(value)).toBe(true);
  });

  it.each([
    '2027-02-29',
    '2026-13-01',
    '2026-00-10',
    '26-10-2026',
    '',
    '2026-10-26T00:00',
    'abcd-ef-gh',
  ])('rejects %s', (value) => {
    expect(isValidIsoDate(value)).toBe(false);
  });
});

describe('day arithmetic', () => {
  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('diffDays is the inverse of addDays', () => {
    fc.assert(
      fc.property(fc.integer({ min: -2000, max: 2000 }), (days) => {
        expect(diffDays(addDays('2026-10-26', days), '2026-10-26')).toBe(days);
      }),
    );
  });

  it('round-trips day numbers', () => {
    expect(fromDayNumber(toDayNumber('2026-10-26'))).toBe('2026-10-26');
  });

  it('throws on invalid dates instead of silently drifting', () => {
    expect(() => toDayNumber('2026-02-30')).toThrow(RangeError);
  });

  it('minDate picks the earlier date', () => {
    expect(minDate('2026-01-02', '2026-01-01')).toBe('2026-01-01');
    expect(minDate('2026-01-01', '2026-01-02')).toBe('2026-01-01');
  });
});

describe('helpers', () => {
  it('todayIso uses the local calendar date', () => {
    expect(todayIso(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
  });

  it('formats dates for Indian readers', () => {
    expect(formatDate('2027-02-23')).toBe('23 Feb 2027');
    expect(formatDateLong('2027-02-23')).toContain('February');
    expect(monthOf('2027-02-23')).toBe(2);
  });

  it('isoFromParts validates parts', () => {
    expect(isoFromParts(2027, 3, 12)).toBe('2027-03-12');
    expect(isoFromParts(2027, 2, 30)).toBeNull();
  });

  it.each([
    [0, 'today'],
    [1, 'tomorrow'],
    [-1, 'yesterday'],
    [5, 'in 5 days'],
    [-3, '3 days ago'],
  ])('relativeDays(%i) = %s', (days, text) => {
    expect(relativeDays(days)).toBe(text);
  });
});
