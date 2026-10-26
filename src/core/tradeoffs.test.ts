import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { profile, quote } from '../../tests/fixtures';
import { estimateBudget } from './budget';
import { applyProfilePatch } from './profile';
import { analyzeTradeoffs, combineLeverPatches, previewLevers } from './tradeoffs';
import { CATEGORIES } from './constants/enums';

/** The sample change outcome: 250 guests on ₹7.2L. */
const overBudget = () => profile({ guests: 250, budget: 720_000 });

describe('analyzeTradeoffs', () => {
  it('returns nothing when the plan fits', () => {
    const result = analyzeTradeoffs(profile({ budget: 2_000_000 }));
    expect(result.levers).toEqual([]);
    expect(result.suggestionClosesGap).toBe(true);
  });

  it('offers concrete levers with savings, ranked best value first', () => {
    const result = analyzeTradeoffs(overBudget());
    expect(result.gap).toBeGreaterThan(0);
    expect(result.levers.length).toBeGreaterThan(3);
    const values = result.levers.map((lever) => lever.saving / lever.pain);
    expect([...values].sort((a, b) => b - a)).toEqual(values);
    for (const lever of result.levers) expect(lever.saving).toBeGreaterThan(0);
  });

  it('suggests a combination that actually closes the gap on an exact recompute', () => {
    const p = overBudget();
    const result = analyzeTradeoffs(p);
    const chosen = result.levers.filter((lever) => result.suggestedIds.includes(lever.id));
    expect(result.suggestionClosesGap).toBe(true);
    expect(previewLevers(p, [], chosen).gap).toBeLessThanOrEqual(0);
  });

  it('never touches protected categories', () => {
    const result = analyzeTradeoffs({
      ...overBudget(),
      protectedCategories: ['catering', 'decor'],
    });
    expect(
      result.levers.some((lever) => lever.category === 'catering' || lever.category === 'decor'),
    ).toBe(false);
  });

  it('respects a locked guest count', () => {
    const result = analyzeTradeoffs({ ...overBudget(), lockGuestCount: true });
    expect(result.levers.some((lever) => lever.kind === 'trim-guests')).toBe(false);
  });

  it('only offers to skip optional, low-priority categories', () => {
    const skips = analyzeTradeoffs(overBudget()).levers.filter(
      (lever) => lever.kind === 'skip-category',
    );
    expect(skips.map((lever) => lever.category).sort()).toEqual(['entertainment', 'gifts']);
  });

  it('caps a guest trim at 25% of the list', () => {
    const p = profile({ guests: 200, budget: 1_000 });
    const trim = analyzeTradeoffs(p).levers.find((lever) => lever.kind === 'trim-guests');
    expect(trim?.patch.guests).toBe(150);
  });

  it('does not tier-down quoted, custom-rate or already-simple categories', () => {
    const p = {
      ...overBudget(),
      tier: 'simple' as const,
      rateOverrides: { decor: { perGuest: 0, fixed: 1 } },
    };
    const levers = analyzeTradeoffs(p, [quote({ status: 'accepted', amount: 900_000 })]).levers;
    expect(levers.some((lever) => lever.kind === 'tier-down')).toBe(false);
  });

  it('skips the buffer lever when it is already at the safe minimum', () => {
    const levers = analyzeTradeoffs({ ...overBudget(), contingencyPct: 5 }).levers;
    expect(levers.some((lever) => lever.kind === 'reduce-buffer')).toBe(false);
  });

  it('reports when even every lever cannot close a huge gap', () => {
    const result = analyzeTradeoffs({
      ...profile({ budget: 1_000 }),
      protectedCategories: [...CATEGORIES],
      lockGuestCount: true,
    });
    expect(result.suggestionClosesGap).toBe(false);
  });
});

describe('combineLeverPatches', () => {
  it('merges tier maps and exclusions', () => {
    const p = overBudget();
    const levers = analyzeTradeoffs(p).levers;
    const picked = levers.filter((lever) =>
      ['tier-down:decor', 'tier-down:venue', 'skip:gifts'].includes(lever.id),
    );
    const patch = combineLeverPatches(p, picked);
    expect(patch.categoryTiers).toEqual({ decor: 'simple', venue: 'simple' });
    expect(patch.excludedCategories).toEqual(['gifts']);
  });

  it('applying the patch lowers the total by roughly the stated saving', () => {
    const p = overBudget();
    const lever = analyzeTradeoffs(p).levers[0];
    if (!lever) throw new Error('expected a lever');
    const before = estimateBudget(p).total;
    const after = estimateBudget(applyProfilePatch(p, combineLeverPatches(p, [lever]))).total;
    expect(Math.abs(before - after - lever.saving)).toBeLessThan(500);
  });
});

describe('trade-off invariants (property-based)', () => {
  it('every lever saves money and none touches a protected category', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 800 }),
        fc.integer({ min: 100_000, max: 900_000 }),
        fc.subarray([...CATEGORIES]),
        (guests, budget, protectedCategories) => {
          const p = { ...profile({ guests, budget }), protectedCategories };
          for (const lever of analyzeTradeoffs(p).levers) {
            expect(lever.saving).toBeGreaterThan(0);
            if (lever.category) expect(protectedCategories).not.toContain(lever.category);
            expect(estimateBudget(applyProfilePatch(p, lever.patch)).total).toBeLessThan(
              estimateBudget(p).total,
            );
          }
        },
      ),
      { numRuns: 60 },
    );
  });
});
