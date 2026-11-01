import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { TODAY } from '../../../tests/fixtures';
import { SAMPLE_CHANGE_TEXT } from '../demo';
import { changesFromAiOutput } from './aiChange';
import { parseExplicitDate } from './explicitDate';
import { parseChangeText, type Change } from './parseChange';
import { resolveChanges } from './resolveChanges';
import { normalizeNumbers, splitClauses } from './text';

const parse = (text: string) => parseChangeText(text, TODAY).changes;
const context = { guests: 200, budget: 800_000, eventDate: '2027-02-23', today: TODAY };

describe('a combined change', () => {
  it('understands "50 more guests, budget down 10%, 2 weeks earlier" in one sentence', () => {
    expect(parse(SAMPLE_CHANGE_TEXT)).toEqual<Change[]>([
      { kind: 'guests', mode: 'delta', value: 50 },
      { kind: 'budget', mode: 'percent', value: -10 },
      { kind: 'date', mode: 'shift', days: -14 },
    ]);
  });

  it('resolves to a validated patch with readable summaries', () => {
    const resolved = resolveChanges(parse(SAMPLE_CHANGE_TEXT), context);
    expect(resolved.patch).toEqual({ guests: 250, budget: 720_000, eventDate: '2027-02-09' });
    expect(resolved.summary).toEqual([
      'Guests: 200 → 250',
      'Budget: ₹8,00,000 → ₹7,20,000',
      'Date: 2027-02-23 → 2027-02-09',
    ]);
    expect(resolved.errors).toEqual([]);
  });

  it('asks instead of guessing when the host says "our budget has decreased a bit"', () => {
    const result = parseChangeText('Our budget has decreased a bit', TODAY);
    expect(result.changes).toEqual([]);
    expect(result.clarifications[0]).toMatch(/how much/i);
  });
});

describe('guest phrasings', () => {
  it.each<[string, Change]>([
    ['we have 50 more guests now', { kind: 'guests', mode: 'delta', value: 50 }],
    ['fifty extra people', { kind: 'guests', mode: 'delta', value: 50 }],
    ['twenty-five additional relatives', { kind: 'guests', mode: 'delta', value: 25 }],
    ['30 fewer guests', { kind: 'guests', mode: 'delta', value: -30 }],
    ['add 40 guests', { kind: 'guests', mode: 'delta', value: 40 }],
    ['+50 people', { kind: 'guests', mode: 'delta', value: 50 }],
    ['remove 10 guests', { kind: 'guests', mode: 'delta', value: -10 }],
    ['guest count is up by 20', { kind: 'guests', mode: 'delta', value: 20 }],
    ['guests dropped by 15', { kind: 'guests', mode: 'delta', value: -15 }],
    ['guests now 250', { kind: 'guests', mode: 'set', value: 250 }],
    ['headcount will be 180', { kind: 'guests', mode: 'set', value: 180 }],
    ['expecting 320 people', { kind: 'guests', mode: 'set', value: 320 }],
    ['expecting a couple of hundred guests', { kind: 'guests', mode: 'set', value: 200 }],
    ['we will have about 300 people', { kind: 'guests', mode: 'set', value: 300 }],
  ])('"%s"', (text, expected) => {
    expect(parse(text)).toEqual([expected]);
  });
});

describe('budget phrasings', () => {
  it.each<[string, Change]>([
    ['budget down 10%', { kind: 'budget', mode: 'percent', value: -10 }],
    ['cut the budget by 15 percent', { kind: 'budget', mode: 'percent', value: -15 }],
    ['budget increased by 5%', { kind: 'budget', mode: 'percent', value: 5 }],
    ['budget is now 7 lakh', { kind: 'budget', mode: 'set', value: 700_000 }],
    ['budget is now ₹7,00,000', { kind: 'budget', mode: 'set', value: 700_000 }],
    ['reduce budget to 7.5 lakh', { kind: 'budget', mode: 'set', value: 750_000 }],
    ['new budget 9L', { kind: 'budget', mode: 'set', value: 900_000 }],
    ['budget cut by 50k', { kind: 'budget', mode: 'delta', value: -50_000 }],
    ['budget went up by ₹1 lakh', { kind: 'budget', mode: 'delta', value: 100_000 }],
    ['we can spend 2 lakh more', { kind: 'budget', mode: 'delta', value: 200_000 }],
  ])('"%s"', (text, expected) => {
    expect(parse(text)).toEqual([expected]);
  });

  it('asks for direction when a percentage has none', () => {
    expect(parseChangeText('budget 10%', TODAY).clarifications[0]).toMatch(/up or down/);
  });

  it('asks when the amount is too small to be rupees', () => {
    expect(parseChangeText('budget down by 5', TODAY).clarifications[0]).toMatch(/how much/i);
    expect(parseChangeText('budget is 50', TODAY).clarifications[0]).toMatch(/how much/i);
  });

  it('ignores "budget is the same"', () => {
    expect(parseChangeText('the budget is the same', TODAY)).toEqual({
      changes: [],
      clarifications: [],
    });
  });
});

describe('date phrasings', () => {
  it.each<[string, Change]>([
    ['the event is happening 2 weeks earlier', { kind: 'date', mode: 'shift', days: -14 }],
    ['postponed by 10 days', { kind: 'date', mode: 'shift', days: 10 }],
    ['event moved earlier by 3 days', { kind: 'date', mode: 'shift', days: -3 }],
    ['push it back a week', { kind: 'date', mode: 'shift', days: 7 }],
    ['prepone by a fortnight', { kind: 'date', mode: 'shift', days: -14 }],
    ['delay one month', { kind: 'date', mode: 'shift', days: 30 }],
    ['move it to 12 March', { kind: 'date', mode: 'set', date: '2027-03-12' }],
    ['new date is March 5th 2027', { kind: 'date', mode: 'set', date: '2027-03-05' }],
    ['rescheduled to 2027-01-15', { kind: 'date', mode: 'set', date: '2027-01-15' }],
    ['shifted to 20/12/2026', { kind: 'date', mode: 'set', date: '2026-12-20' }],
  ])('"%s"', (text, expected) => {
    expect(parse(text)).toEqual([expected]);
  });

  it('asks for direction or a date when it is vague', () => {
    expect(parseChangeText('move the date by 5 days', TODAY).clarifications[0]).toMatch(
      /earlier or later/,
    );
    expect(parseChangeText('we have to postpone', TODAY).clarifications[0]).toMatch(/new date/);
  });

  it('infers next year for a day-month that has already passed', () => {
    expect(parseExplicitDate('1 jan', TODAY)).toBe('2027-01-01');
    expect(parseExplicitDate('15 nov', TODAY)).toBe('2026-11-15');
    expect(parseExplicitDate('5/1', TODAY)).toBe('2027-01-05');
    expect(parseExplicitDate('31/02/2027', TODAY)).toBeNull();
    expect(parseExplicitDate('12-3-27', TODAY)).toBe('2027-03-12');
  });
});

describe('parser robustness', () => {
  it('leaves negated, ambiguous guest sentences to the AI', () => {
    expect(parse('my in-laws are not coming now, roughly forty people')).toEqual([]);
    expect(parse('the 40 people from office')).toEqual([]);
  });

  it('returns nothing for unrelated text so the AI can be consulted', () => {
    expect(parseChangeText('make it feel smaller and cosier', TODAY)).toEqual({
      changes: [],
      clarifications: [],
    });
  });

  it('never throws on arbitrary input', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (text) => {
        const result = parseChangeText(text, TODAY);
        expect(Array.isArray(result.changes)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it('normalizes number words and splits clauses without breaking amounts', () => {
    expect(normalizeNumbers('Fifty-five more, a week, a couple of days, two hundred')).toBe(
      '55 more, 1 week, 2 days, 200',
    );
    expect(splitClauses('budget is 7,00,000. and 7.5 lakh, then')).toEqual([
      'budget is 7,00,000',
      '7.5 lakh',
      'then',
    ]);
  });
});

describe('resolveChanges validation', () => {
  it('rejects impossible results', () => {
    const result = resolveChanges(
      [
        { kind: 'guests', mode: 'delta', value: -500 },
        { kind: 'budget', mode: 'set', value: 10 },
        { kind: 'date', mode: 'shift', days: -400 },
      ],
      context,
    );
    expect(result.patch).toEqual({});
    expect(result.errors).toHaveLength(3);
  });

  it('rejects dates more than two years away', () => {
    expect(
      resolveChanges([{ kind: 'date', mode: 'set', date: '2030-01-01' }], context).errors[0],
    ).toMatch(/two years/);
  });

  it('applies sequential changes in order', () => {
    const result = resolveChanges(
      [
        { kind: 'budget', mode: 'delta', value: -100_000 },
        { kind: 'budget', mode: 'percent', value: 10 },
        { kind: 'guests', mode: 'set', value: 210 },
      ],
      context,
    );
    expect(result.patch).toEqual({ budget: 770_000, guests: 210 });
  });

  it('produces an empty patch for no-op changes', () => {
    expect(resolveChanges([{ kind: 'guests', mode: 'delta', value: 0 }], context).patch).toEqual(
      {},
    );
  });
});

describe('changesFromAiOutput', () => {
  it('maps the flat model output to changes, preferring absolute values', () => {
    expect(
      changesFromAiOutput({
        guestsSet: 260,
        guestsDelta: 5,
        budgetSet: 700_000,
        dateSet: '2027-03-01',
        dateShiftDays: 4,
      }).changes,
    ).toEqual([
      { kind: 'guests', mode: 'set', value: 260 },
      { kind: 'budget', mode: 'set', value: 700_000 },
      { kind: 'date', mode: 'set', date: '2027-03-01' },
    ]);
    expect(
      changesFromAiOutput({ guestsDelta: 10, budgetPercent: -5, dateShiftDays: -7 }).changes,
    ).toHaveLength(3);
    expect(changesFromAiOutput({ budgetDelta: -20_000 }).changes).toEqual([
      { kind: 'budget', mode: 'delta', value: -20_000 },
    ]);
  });

  it('passes a clarification through only when nothing was understood', () => {
    expect(changesFromAiOutput({ clarification: 'How many guests?' })).toEqual({
      changes: [],
      clarifications: ['How many guests?'],
    });
    expect(changesFromAiOutput({ guestsDelta: 3, clarification: 'x' }).clarifications).toEqual([]);
    expect(
      changesFromAiOutput({ guestsDelta: 0, budgetPercent: 0, budgetDelta: 0, dateShiftDays: 0 })
        .changes,
    ).toEqual([]);
  });
});
