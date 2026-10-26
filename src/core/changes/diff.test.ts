import { describe, expect, it } from 'vitest';

import { plan, quote, TODAY } from '../../../tests/fixtures';
import { createDemoPlan, CHANGE_TEST_TEXT, withProfilePatch } from '../plan';
import { diffPlans } from './diff';
import { parseChangeText, resolveChanges } from './parseChange';

describe('diffPlans — a combined change end to end', () => {
  const before = createDemoPlan('wedding', { id: 'demo', now: 'now', today: TODAY });
  const { patch } = resolveChanges(parseChangeText(CHANGE_TEST_TEXT, TODAY).changes, {
    guests: before.profile.guests,
    budget: before.profile.budget,
    eventDate: before.profile.eventDate,
    today: TODAY,
  });
  const after = withProfilePatch(before, patch);
  const diff = diffPlans(before, after, TODAY);

  it('lists every changed field', () => {
    expect(diff.fieldChanges.map((change) => change.field)).toEqual([
      'guests',
      'budget',
      'eventDate',
    ]);
    expect(diff.fieldChanges[0]).toMatchObject({ from: '200', to: '250' });
  });

  it('shows the plan tipping from tight to over budget, with line deltas', () => {
    expect(diff.budget.before.status).toBe('tight');
    expect(diff.budget.after.status).toBe('over');
    expect(diff.budget.lines[0]).toMatchObject({ category: 'catering', delta: 55_000 });
    expect(diff.budget.lines.every((line) => line.delta !== 0)).toBe(true);
  });

  it('shows the timeline compressing and tasks moving', () => {
    expect(diff.schedule.daysLeftBefore - diff.schedule.daysLeftAfter).toBe(14);
    expect(diff.schedule.becameCompressed).toBe(true);
    expect(diff.schedule.movedTasks).toBeGreaterThan(0);
  });

  it('flags quotes that no longer cover everyone', () => {
    expect(diff.requotes.map((notice) => notice.vendorLabel)).toEqual([
      'Caterer A (sample)',
      'Caterer B (sample)',
    ]);
    expect(diff.requotes[0]?.reason).toMatch(/250/);
  });

  it('keeps completed work and quotes', () => {
    expect(diff.kept).toEqual({ doneTasks: 2, quotes: 2, hasIdeas: false });
    expect(diff.isEmpty).toBe(false);
  });
});

describe('diffPlans — other cases', () => {
  it('asks to re-confirm vendors when only the date moves', () => {
    const before = plan({ quotes: [quote()] });
    const after = withProfilePatch(before, { eventDate: '2027-03-10' });
    const diff = diffPlans(before, after, TODAY);
    expect(diff.requotes[0]?.reason).toMatch(/Confirm they are free/);
  });

  it('reports newly overdue tasks when the event moves much earlier', () => {
    const before = plan({ startDate: '2026-08-01' });
    const after = withProfilePatch(before, { eventDate: '2026-11-20' });
    const diff = diffPlans(before, after, TODAY);
    expect(diff.schedule.newlyOverdue.length).toBeGreaterThan(0);
  });

  it('describes tier and buffer changes and drops removed lines', () => {
    const before = plan();
    const after = withProfilePatch(before, {
      tier: 'premium',
      contingencyPct: 5,
      excludedCategories: ['gifts'],
    });
    const diff = diffPlans(before, after, TODAY);
    expect(diff.fieldChanges.map((change) => change.field)).toEqual(['tier', 'contingencyPct']);
    expect(diff.budget.lines.find((line) => line.category === 'gifts')?.after).toBe(0);
  });

  it('is empty when nothing changes', () => {
    const before = plan();
    expect(diffPlans(before, before, TODAY).isEmpty).toBe(true);
  });
});
