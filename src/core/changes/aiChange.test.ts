import { describe, expect, it } from 'vitest';

import { CHANGE_HELP, changesFromAiOutput, changesToOutput } from './aiChange';
import type { Change } from './parseChange';

describe('changesFromAiOutput', () => {
  it('prefers a "set" over a relative change of the same kind and ignores zero deltas', () => {
    expect(
      changesFromAiOutput({ guestsSet: 250, guestsDelta: 50, budgetDelta: 0, dateShiftDays: 0 }),
    ).toEqual({ changes: [{ kind: 'guests', mode: 'set', value: 250 }], clarifications: [] });
  });

  it('reads percentage budget changes before absolute ones', () => {
    expect(changesFromAiOutput({ budgetPercent: -10, budgetDelta: -5000 }).changes).toEqual([
      { kind: 'budget', mode: 'percent', value: -10 },
    ]);
  });

  it('keeps a clarification only when nothing was understood', () => {
    expect(changesFromAiOutput({ clarification: 'By how much?' }).clarifications).toEqual([
      'By how much?',
    ]);
    expect(
      changesFromAiOutput({ guestsDelta: 5, clarification: 'By how much?' }).clarifications,
    ).toEqual([]);
  });
});

describe('changesToOutput', () => {
  it.each<[Change[], object]>([
    [
      [
        { kind: 'guests', mode: 'set', value: 250 },
        { kind: 'budget', mode: 'set', value: 700_000 },
        { kind: 'date', mode: 'set', date: '2027-01-01' },
      ],
      { guestsSet: 250, budgetSet: 700_000, dateSet: '2027-01-01' },
    ],
    [[{ kind: 'budget', mode: 'delta', value: -5 }], { budgetDelta: -5 }],
    [[{ kind: 'budget', mode: 'percent', value: -10 }], { budgetPercent: -10 }],
    [[{ kind: 'date', mode: 'shift', days: -14 }], { dateShiftDays: -14 }],
    [[{ kind: 'guests', mode: 'delta', value: 50 }], { guestsDelta: 50 }],
  ])('maps %j', (changes, expected) => {
    expect(changesToOutput(changes, [])).toEqual(expected);
  });

  it('carries the first clarification, or the help text, when there are no changes', () => {
    expect(changesToOutput([], ['By how much?'])).toEqual({ clarification: 'By how much?' });
    expect(changesToOutput([], [])).toEqual({ clarification: CHANGE_HELP });
  });

  it('round-trips with changesFromAiOutput', () => {
    const changes: Change[] = [
      { kind: 'guests', mode: 'delta', value: 50 },
      { kind: 'budget', mode: 'percent', value: -10 },
      { kind: 'date', mode: 'shift', days: -14 },
    ];
    expect(changesFromAiOutput(changesToOutput(changes, [])).changes).toEqual(changes);
  });
});
