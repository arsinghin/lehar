import { describe, expect, it } from 'vitest';

import { plan, quote, TODAY } from '../../tests/fixtures';
import { createDemoPlan } from '../core/plan';
import {
  isStorageWritable,
  loadStore,
  MAX_IMPORT_BYTES,
  parsePlanFile,
  saveStore,
  STORAGE_KEY,
} from './persistence';
import { EMPTY_STORE, storeReducer, type StoreAction, type StoreState } from './store';

const AT = '2026-10-26T10:00:00.000Z';
const run = (state: StoreState, ...actions: StoreAction[]) => actions.reduce(storeReducer, state);
const opened = () =>
  run(EMPTY_STORE, { type: 'plan/open', plan: plan(), reason: 'Created', at: AT });

describe('storeReducer', () => {
  it('opens a plan without history, then records every later change', () => {
    const state = opened();
    expect(state.past).toEqual([]);
    const next = run(state, {
      type: 'plan/patch',
      patch: { guests: 250 },
      reason: 'More guests',
      at: AT,
    });
    expect(next.plan?.profile.guests).toBe(250);
    expect(next.past.map((snapshot) => snapshot.reason)).toEqual(['More guests']);
    expect(next.past[0]?.plan.profile.guests).toBe(200);
  });

  it('undoes and redoes, and a new change clears the redo stack', () => {
    const changed = run(opened(), {
      type: 'plan/patch',
      patch: { guests: 250 },
      reason: 'More guests',
      at: AT,
    });
    const undone = run(changed, { type: 'history/undo' });
    expect(undone.plan?.profile.guests).toBe(200);
    expect(undone.future).toHaveLength(1);
    const redone = run(undone, { type: 'history/redo' });
    expect(redone.plan?.profile.guests).toBe(250);
    const branched = run(undone, {
      type: 'plan/patch',
      patch: { budget: 5000 },
      reason: 'x',
      at: AT,
    });
    expect(branched.future).toEqual([]);
  });

  it('ignores undo or redo with nothing to undo, and actions without a plan', () => {
    expect(run(opened(), { type: 'history/undo' })).toEqual(opened());
    expect(run(opened(), { type: 'history/redo' })).toEqual(opened());
    expect(
      run(EMPTY_STORE, { type: 'plan/patch', patch: { guests: 1 }, reason: 'x', at: AT }),
    ).toBe(EMPTY_STORE);
  });

  it('caps history at 20 versions', () => {
    let state = opened();
    for (let i = 0; i < 30; i += 1)
      state = run(state, {
        type: 'plan/patch',
        patch: { guests: 100 + i },
        reason: `#${String(i)}`,
        at: AT,
      });
    expect(state.past).toHaveLength(20);
    expect(state.past[0]?.reason).toBe('#10');
  });

  it('marks tasks done and delays them, clamping the delay', () => {
    const state = run(
      opened(),
      { type: 'task/setDone', taskId: 'fix-date', title: 'Fix date', done: true, at: AT },
      { type: 'task/delay', taskId: 'book-venue', title: 'Venue', days: 999, at: AT },
      { type: 'task/delay', taskId: 'book-venue', title: 'Venue', days: 0, at: AT },
      { type: 'task/setDone', taskId: 'fix-date', title: 'Fix date', done: false, at: AT },
    );
    expect(state.plan?.progress['fix-date']).toEqual({ done: false, delayDays: 0 });
    expect(state.past.map((s) => s.reason)).toEqual([
      'Marked done: Fix date',
      'Delayed Venue by 120 days',
      'Cleared delay: Venue',
      'Reopened: Fix date',
    ]);
  });

  it('keeps one accepted quote per category', () => {
    const state = run(
      opened(),
      { type: 'quote/add', quote: quote({ id: 'a' }), at: AT },
      { type: 'quote/add', quote: quote({ id: 'b' }), at: AT },
      { type: 'quote/setStatus', id: 'a', status: 'accepted', at: AT },
      { type: 'quote/setStatus', id: 'b', status: 'accepted', at: AT },
    );
    expect(state.plan?.quotes.map((q) => q.status)).toEqual(['shortlisted', 'accepted']);
    const removed = run(
      state,
      { type: 'quote/remove', id: 'a', at: AT },
      { type: 'quote/remove', id: 'missing', at: AT },
    );
    expect(removed.plan?.quotes.map((q) => q.id)).toEqual(['b']);
    expect(run(state, { type: 'quote/setStatus', id: 'missing', status: 'accepted', at: AT })).toBe(
      state,
    );
  });

  it('refuses quotes beyond the limit', () => {
    let state = opened();
    for (let i = 0; i < 41; i += 1)
      state = run(state, { type: 'quote/add', quote: quote({ id: `q${String(i)}` }), at: AT });
    expect(state.plan?.quotes).toHaveLength(40);
  });

  it('stores ideas and vendor questions without polluting history', () => {
    const state = run(
      opened(),
      { type: 'ideas/set', ideas: { items: [], source: 'rules' } as never },
      {
        type: 'vendorQuestions/set',
        category: 'catering',
        value: { questions: ['Is GST included?'], source: 'gemini' },
      },
    );
    expect(state.past).toEqual([]);
    expect(state.plan?.vendorQuestions.catering?.source).toBe('gemini');
  });

  it('resets a custom rate and restores old versions as a new, undoable change', () => {
    const custom = run(opened(), {
      type: 'plan/patch',
      patch: { rateOverrides: { decor: { perGuest: 0, fixed: 1 } } },
      reason: 'Custom',
      at: AT,
    });
    const reset = run(custom, {
      type: 'plan/resetRate',
      category: 'decor',
      reason: 'Reset',
      at: AT,
    });
    expect(reset.plan?.profile.rateOverrides).toEqual({});
    expect(run(reset, { type: 'plan/resetRate', category: 'decor', reason: 'Reset', at: AT })).toBe(
      reset,
    );
    const restored = run(reset, { type: 'history/restore', index: 0, at: AT });
    expect(restored.plan?.profile.rateOverrides).toEqual({});
    expect(restored.past.at(-1)?.reason).toMatch(/Restored/);
    expect(run(reset, { type: 'history/restore', index: 99, at: AT })).toBe(reset);
  });

  it('opening another plan keeps the previous one in history', () => {
    const state = run(opened(), {
      type: 'plan/open',
      plan: plan({ id: 'other' }),
      reason: 'Opened demo',
      at: AT,
    });
    expect(state.plan?.id).toBe('other');
    expect(state.past[0]?.plan.id).toBe('plan-1');
  });
});

describe('persistence', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
      data,
    };
  };

  it('round-trips a store and trims stored history', () => {
    const storage = memory();
    let state = opened();
    for (let i = 0; i < 15; i += 1)
      state = run(state, {
        type: 'plan/patch',
        patch: { guests: 100 + i },
        reason: String(i),
        at: AT,
      });
    expect(saveStore(storage, state)).toBe(true);
    const loaded = loadStore(storage);
    expect(loaded.status).toBe('loaded');
    if (loaded.status === 'loaded') {
      expect(loaded.store.plan).toEqual(state.plan);
      expect(loaded.store.past).toHaveLength(10);
    }
  });

  it('reports empty, invalid, tampered and unavailable storage', () => {
    const storage = memory();
    expect(loadStore(storage)).toEqual({ status: 'empty' });
    storage.setItem(STORAGE_KEY, '{not json');
    expect(loadStore(storage)).toEqual({ status: 'invalid' });
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ storeVersion: 1, plan: { hacked: true }, past: [] }),
    );
    expect(loadStore(storage)).toEqual({ status: 'invalid' });
    expect(loadStore(null)).toEqual({ status: 'unavailable' });
    expect(
      loadStore({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toEqual({ status: 'unavailable' });
  });

  it('removes the key when the plan closes and survives quota errors', () => {
    const storage = memory();
    saveStore(storage, opened());
    expect(saveStore(storage, EMPTY_STORE)).toBe(true);
    expect(storage.data.has(STORAGE_KEY)).toBe(false);
    expect(
      saveStore(
        {
          setItem: () => {
            throw new Error('quota');
          },
          removeItem: () => undefined,
        },
        opened(),
      ),
    ).toBe(false);
    expect(saveStore(null, opened())).toBe(false);
  });

  it('probes whether storage accepts writes', () => {
    expect(isStorageWritable(memory())).toBe(true);
    expect(isStorageWritable(null)).toBe(false);
    expect(
      isStorageWritable({
        setItem: () => {
          throw new Error('blocked');
        },
        removeItem: () => undefined,
      }),
    ).toBe(false);
  });

  it('validates imported plan files', () => {
    const demo = createDemoPlan('wedding', { id: 'd', now: AT, today: TODAY });
    expect(parsePlanFile(JSON.stringify(demo))).toEqual({ ok: true, plan: demo });
    expect(parsePlanFile('nope')).toMatchObject({
      ok: false,
      message: expect.stringMatching(/JSON/) as string,
    });
    expect(parsePlanFile('{"schemaVersion":1}')).toMatchObject({
      ok: false,
      message: expect.stringMatching(/valid Lehar/) as string,
    });
    expect(parsePlanFile('x'.repeat(MAX_IMPORT_BYTES + 1))).toMatchObject({
      ok: false,
      message: expect.stringMatching(/too large/) as string,
    });
  });
});
