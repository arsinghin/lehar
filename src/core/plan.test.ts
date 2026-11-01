import { describe, expect, it } from 'vitest';

import { profile, TODAY } from '../../tests/fixtures';
import { createDemoPlan, DEMO_SCENARIOS } from './demo';
import { createPlanState, derivePlan, whatIfPatch, withProfilePatch } from './plan';
import { PlanStateSchema } from './schemas';

describe('plan lifecycle', () => {
  it.each(DEMO_SCENARIOS.map((scenario) => scenario.id))(
    'demo "%s" is a valid, explorable plan',
    (id) => {
      const demo = createDemoPlan(id, { id: 'd', now: 'now', today: TODAY });
      expect(PlanStateSchema.safeParse(demo).success).toBe(true);
      const derived = derivePlan(demo, TODAY);
      expect(derived.budget.lines.length).toBeGreaterThan(4);
      expect(derived.schedule.tasks.length).toBeGreaterThan(8);
      expect(derived.vendorBriefs.length).toBeGreaterThan(3);
    },
  );

  it('the over-budget demo is about 20% over and offers trade-offs', () => {
    const demo = createDemoPlan('over-budget', { id: 'd', now: 'now', today: TODAY });
    const derived = derivePlan(demo, TODAY);
    expect(derived.budget.gapRatio).toBeGreaterThan(0.18);
    expect(derived.budget.gapRatio).toBeLessThan(0.22);
    expect(derived.tradeoffs.levers.length).toBeGreaterThan(0);
  });

  it('creates and patches plans immutably', () => {
    const state = createPlanState(profile(), { id: 'p', now: 'now', today: TODAY });
    expect(state).toMatchObject({ schemaVersion: 1, startDate: TODAY, isDemo: false, quotes: [] });
    const patched = withProfilePatch(state, { guests: 10, categoryTiers: { decor: 'simple' } });
    expect(patched.profile.guests).toBe(10);
    expect(state.profile.guests).toBe(200);
  });

  it('builds a what-if patch only for values that change', () => {
    const base = profile();
    expect(whatIfPatch(base, base.guests, base.budget)).toBeNull();
    expect(whatIfPatch(base, 150, base.budget)).toEqual({
      patch: { guests: 150 },
      summary: 'guests 200 → 150',
    });
    expect(whatIfPatch(base, base.guests, 700_000)?.summary).toBe('budget ₹8,00,000 → ₹7,00,000');
  });
});
