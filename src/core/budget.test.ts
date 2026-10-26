import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { profile, quote } from '../../tests/fixtures';
import {
  acceptedQuoteFor,
  activeCategories,
  categoryRate,
  contingencyFor,
  costForRate,
  estimateBudget,
} from './budget';
import { CATEGORIES, EVENT_TYPES, TIERS } from './constants/enums';

describe('estimateBudget — demo wedding (₹8L, 200 guests, standard)', () => {
  const summary = estimateBudget(profile());

  it('produces one line per applicable category', () => {
    expect(summary.lines.map((line) => line.category)).toEqual([...CATEGORIES]);
  });

  it('computes guest-scaled and fixed costs from the documented assumptions', () => {
    const byCategory = Object.fromEntries(
      summary.lines.map((line) => [line.category, line.amount]),
    );
    expect(byCategory).toMatchObject({
      venue: 120_000,
      catering: 220_000,
      decor: 90_000,
      photo: 75_000,
    });
  });

  it('adds a 10% buffer and reports status against the budget', () => {
    expect(summary.subtotal).toBe(725_000);
    expect(summary.contingency).toBe(72_500);
    expect(summary.total).toBe(797_500);
    expect(summary.gap).toBe(-2_500);
    expect(summary.status).toBe('tight');
    expect(summary.perGuest).toBe(3988);
  });

  it('labels every line as an estimate with its assumption', () => {
    for (const line of summary.lines) {
      expect(line.basis).toBe('estimate');
      expect(line.assumption.length).toBeGreaterThan(5);
    }
  });
});

describe('estimateBudget — states and warnings', () => {
  it('is "within" when comfortably below budget', () => {
    expect(estimateBudget(profile({ budget: 2_000_000 })).status).toBe('within');
  });

  it('is "over" when above budget, with the gap ratio', () => {
    const summary = estimateBudget(profile({ budget: 665_000 }));
    expect(summary.status).toBe('over');
    expect(summary.gapRatio).toBeCloseTo(0.199, 2);
  });

  it('applies per-category tiers and custom rates', () => {
    const premiumDecor = estimateBudget(profile({ categoryTiers: { decor: 'premium' } }));
    expect(premiumDecor.lines.find((l) => l.category === 'decor')?.amount).toBe(153_000);
    const custom = estimateBudget(
      profile({ rateOverrides: { catering: { perGuest: 900, fixed: 5_000 } } }),
    );
    const catering = custom.lines.find((l) => l.category === 'catering');
    expect(catering?.amount).toBe(185_000);
    expect(catering?.rateIsCustom).toBe(true);
    expect(catering?.assumption).toBe('Your own rate');
  });

  it('uses an accepted quote instead of the estimate and flags large overruns', () => {
    const summary = estimateBudget(profile(), [quote({ amount: 300_000, status: 'accepted' })]);
    const catering = summary.lines.find((l) => l.category === 'catering');
    expect(catering).toMatchObject({
      basis: 'quote',
      amount: 300_000,
      estimate: 220_000,
      quoteLabel: 'Caterer A',
    });
    expect(summary.warnings.map((w) => w.code)).toContain('quote-over-estimate');
  });

  it('ignores quotes that are not accepted', () => {
    const summary = estimateBudget(profile(), [quote({ amount: 1, status: 'shortlisted' })]);
    expect(summary.lines.find((l) => l.category === 'catering')?.basis).toBe('estimate');
  });

  it('warns when an accepted quote covers fewer guests than expected', () => {
    const summary = estimateBudget(profile({ guests: 250 }), [
      quote({ status: 'accepted', guestsCovered: 200 }),
    ]);
    expect(summary.warnings.map((w) => w.code)).toContain('quote-short-of-guests');
  });

  it('warns about unrealistic per-plate food, a tiny budget and a zero buffer', () => {
    const summary = estimateBudget(
      profile({
        budget: 100_000,
        contingencyPct: 0,
        rateOverrides: { catering: { perGuest: 100, fixed: 0 } },
      }),
    );
    expect(summary.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(['catering-below-floor', 'budget-per-guest-low', 'no-contingency']),
    );
  });

  it('drops excluded categories and categories with no base rate', () => {
    expect(activeCategories(profile({ excludedCategories: ['entertainment'] }))).not.toContain(
      'entertainment',
    );
    const birthday = profile({}, { eventType: 'birthday', guests: 30, budget: 60_000 });
    expect(activeCategories(birthday)).not.toContain('attire');
    expect(categoryRate(birthday, 'attire')).toBeNull();
  });

  it('finds the accepted quote for a category', () => {
    const quotes = [quote({ id: 'a' }), quote({ id: 'b', status: 'accepted' })];
    expect(acceptedQuoteFor(quotes, 'catering')?.id).toBe('b');
    expect(acceptedQuoteFor(quotes, 'venue')).toBeUndefined();
  });
});

describe('budget invariants (property-based)', () => {
  const arbProfile = fc.record({
    eventType: fc.constantFrom(...EVENT_TYPES),
    tier: fc.constantFrom(...TIERS),
    guests: fc.integer({ min: 1, max: 5000 }),
    budget: fc.integer({ min: 1000, max: 100_000_000 }),
    contingencyPct: fc.integer({ min: 0, max: 20 }),
  });

  it('lines always sum exactly to the subtotal, and nothing is negative', () => {
    fc.assert(
      fc.property(arbProfile, (seed) => {
        const p = profile({ tier: seed.tier, contingencyPct: seed.contingencyPct }, seed);
        const s = estimateBudget(p);
        expect(s.lines.reduce((sum, line) => sum + line.amount, 0)).toBe(s.subtotal);
        expect(s.total).toBe(s.subtotal + s.contingency);
        for (const line of s.lines) expect(line.amount).toBeGreaterThanOrEqual(0);
        expect(s.gap).toBe(s.total - p.budget);
      }),
    );
  });

  it('more guests never make the plan cheaper', () => {
    fc.assert(
      fc.property(arbProfile, fc.integer({ min: 1, max: 500 }), (seed, extra) => {
        const base = profile({ tier: seed.tier }, seed);
        const bigger = { ...base, guests: Math.min(5000, base.guests + extra) };
        expect(estimateBudget(bigger).total).toBeGreaterThanOrEqual(estimateBudget(base).total);
      }),
    );
  });

  it('a higher tier never costs less', () => {
    fc.assert(
      fc.property(arbProfile, (seed) => {
        const totals = TIERS.map((tier) => estimateBudget(profile({ tier }, seed)).total);
        expect(totals[0]).toBeLessThanOrEqual(totals[1] ?? 0);
        expect(totals[1]).toBeLessThanOrEqual(totals[2] ?? 0);
      }),
    );
  });
});

describe('helpers', () => {
  it('rounds estimates to ₹100', () => {
    expect(costForRate({ perGuest: 333, fixed: 0 }, 3)).toBe(1000);
    expect(contingencyFor(725_000, 10)).toBe(72_500);
  });
});
