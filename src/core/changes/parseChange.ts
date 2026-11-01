/**
 * Deterministic natural-language change parser (English, Indian number conventions).
 *
 * Handles combined changes ("we have 50 more guests, the budget is down 10%, and the event is
 * 2 weeks earlier") without any AI call. When the text is vague ("the budget decreased a bit") it
 * returns a clarifying question instead of guessing. The AI is only consulted when nothing is understood.
 */
import { LIMITS } from '../constants/limits.js';
import type { IsoDate } from '../dates.js';
import { AMOUNT_PATTERN, amountFromMatch } from '../money.js';
import { parseExplicitDate } from './explicitDate.js';
import { normalizeNumbers, splitClauses } from './text.js';

export type Change =
  | { kind: 'guests'; mode: 'delta' | 'set'; value: number }
  | { kind: 'budget'; mode: 'delta' | 'set' | 'percent'; value: number }
  | { kind: 'date'; mode: 'shift'; days: number }
  | { kind: 'date'; mode: 'set'; date: IsoDate };

export interface ParsedChange {
  changes: Change[];
  clarifications: string[];
}

const GUEST_NOUN = String.raw`(?:guests?|people|persons?|attendees|pax|invitees|relatives|friends|members|families)`;
const DECREASE =
  /\b(cut|cuts|reduc\w*|decreas\w*|lower\w*|down|drop\w*|shr[iu]nk\w*|less|fell|fall\w*|slash\w*|tighter)\b/;
const INCREASE =
  /\b(increas\w*|rais\w*|up|grew|grow\w*|more|extra|higher|boost\w*|add\w*|bigger)\b/;
const EARLIER = /\b(earlier|sooner|before|ahead|early|prepone\w*|advance\w*|forward)\b/;
const LATER = /\b(later|after|delay\w*|postpone\w*|push\w*|back)\b/;
const DATE_VERB =
  /\b(postpone\w*|prepone\w*|reschedul\w*|mov\w*|shift\w*|chang\w*|new date|date)\b/;
const NEGATION =
  /\b(not|no longer|won't|wont|can't|cannot|isn't|aren't|cancel\w*|dropp\w* out|backed out)\b/;

type GuestRule = [pattern: RegExp, toChange: (match: RegExpExecArray) => Change];

const guestRule = (source: string, toChange: GuestRule[1]): GuestRule => [
  new RegExp(source),
  toChange,
];
const count = (match: RegExpExecArray, group: number) => Number(match[group]);

/** Tried in order; the first match wins. Patterns are compiled once. */
const GUEST_RULES: readonly GuestRule[] = [
  // "50 more guests", "20 fewer people"
  guestRule(String.raw`(\d+)\s+(more|extra|additional|new|fewer|less)\s+${GUEST_NOUN}`, (m) => ({
    kind: 'guests',
    mode: 'delta',
    value: (m[2] === 'fewer' || m[2] === 'less' ? -1 : 1) * count(m, 1),
  })),
  // "guests have gone up by 30"
  guestRule(
    String.raw`${GUEST_NOUN}\s+(?:count\s+)?(?:is\s+|are\s+|has\s+|have\s+)?(?:gone\s+)?(up|increased|grew|grown|risen|rose|down|decreased|reduced|dropped)\s+(?:by\s+)?(\d+)`,
    (m) => ({
      kind: 'guests',
      mode: 'delta',
      value: (/up|increased|grew|grown|risen|rose/.test(m[1] ?? '') ? 1 : -1) * count(m, 2),
    }),
  ),
  // "add 10 more people", "+25 guests"
  guestRule(
    String.raw`(?:\badd(?:ing|ed)?|\binvit(?:e|ing|ed)|\bplus|\+)\s*(?:another\s+)?(\d+)\s*(?:more\s+)?${GUEST_NOUN}`,
    (m) => ({ kind: 'guests', mode: 'delta', value: count(m, 1) }),
  ),
  // "remove 15 guests", "-10 people"
  guestRule(
    String.raw`(?:\bremov(?:e|ing|ed)|\bdrop(?:ping|ped)?|\bcut(?:ting)?|\bminus|-)\s*(\d+)\s*${GUEST_NOUN}`,
    (m) => ({ kind: 'guests', mode: 'delta', value: -count(m, 1) }),
  ),
  // "guest count is now 250"
  guestRule(
    String.raw`(?:guest\s*count|headcount|guests?|attendees|people)\s*(?:is|are|will\s+be|becomes|now|to|of|=|:)?\s*(?:now\s+)?(?:about|around|approx\.?|~)?\s*(\d+)\b(?!\s*(?:%|percent|days?|weeks?|months?|lakhs?|lacs?|crores?|k\b))`,
    (m) => ({ kind: 'guests', mode: 'set', value: count(m, 1) }),
  ),
];

/** The weakest pattern ("about 300 people"). Skipped when the message contains a negation. */
const LOOSE_GUEST_SET = guestRule(
  String.raw`\b(?:expect\w*|now|total(?:\s+of)?|about|around|approximately|roughly|have|having|be|for)\s+(?:about\s+|around\s+|roughly\s+)?(\d+)\s+${GUEST_NOUN}\b`,
  (m) => ({ kind: 'guests', mode: 'set', value: count(m, 1) }),
);

function parseGuests(clause: string, allowLooseSet: boolean): Change | null {
  // Negations ("my in-laws are not coming, about 40 people") are ambiguous, so leave them to the AI.
  const rules = allowLooseSet ? [...GUEST_RULES, LOOSE_GUEST_SET] : GUEST_RULES;
  for (const [pattern, toChange] of rules) {
    const match = pattern.exec(clause);
    if (match) return toChange(match);
  }
  return null;
}

const BUDGET_CLARIFY =
  'By how much did the budget change? For example: “budget down by ₹50,000” or “budget is now 7 lakh”.';

/** How far before the word "budget" a direction word ("cut", "up") may appear. */
const BUDGET_LOOKBEHIND_CHARS = 30;
/** A bare number below this ("down by 50") is ambiguous without a unit or ₹. */
const MIN_BARE_BUDGET_DELTA = 100;

interface ClauseResult {
  change: Change | null;
  clarification: string | null;
}

const NOTHING: ClauseResult = { change: null, clarification: null };
const found = (change: Change): ClauseResult => ({ change, clarification: null });
const ask = (clarification: string): ClauseResult => ({ change: null, clarification });

/** The part of the clause about the budget, or null when it does not mention one. */
function budgetText(clause: string): string | null {
  const at = clause.search(/\b(budget|funds|money|spend(?:ing)?)\b/);
  if (at < 0) return null;
  const text = clause.slice(Math.max(0, at - BUDGET_LOOKBEHIND_CHARS));
  return /\b(same|unchanged|no change|not changed)\b/.test(text) ? null : text;
}

/** "to 7 lakh", "is now ₹6,00,000", or any amount with no direction word: the new total. */
function isTargetAmount(before: string, hasDirection: boolean): boolean {
  return !hasDirection || /\bto\s*$|\b(is|now|=|:|of|becomes|be)\s*$/.test(before);
}

function budgetAmount(text: string, sign: number, hasDirection: boolean): ClauseResult | null {
  const amount = new RegExp(AMOUNT_PATTERN.source, 'i').exec(text);
  const value = amount?.[1] ? amountFromMatch(amount[1], amount[2]) : null;
  if (!amount || value === null) return null;
  if (isTargetAmount(text.slice(0, amount.index), hasDirection)) {
    if (value < LIMITS.minBudget) return ask(BUDGET_CLARIFY);
    return found({ kind: 'budget', mode: 'set', value });
  }
  const hasUnitOrSymbol = Boolean(amount[2]) || /₹|rs|inr/.test(amount[0]);
  if (value < MIN_BARE_BUDGET_DELTA && !hasUnitOrSymbol) return ask(BUDGET_CLARIFY);
  return found({ kind: 'budget', mode: 'delta', value: sign * value });
}

function parseBudget(clause: string): ClauseResult {
  const text = budgetText(clause);
  if (text === null) return NOTHING;
  const decrease = DECREASE.test(text);
  const increase = !decrease && INCREASE.test(text);
  const hasDirection = decrease || increase;
  const sign = decrease ? -1 : 1;

  const percent = /(\d+(?:\.\d+)?)\s*(?:%|percent|per\s*cent)/.exec(text);
  if (percent) {
    if (!hasDirection) return ask('Did the budget go up or down by that percentage?');
    return found({ kind: 'budget', mode: 'percent', value: sign * Number(percent[1]) });
  }
  return budgetAmount(text, sign, hasDirection) ?? (hasDirection ? ask(BUDGET_CLARIFY) : NOTHING);
}

const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, fortnight: 14, month: 30 };
/** "2 weeks earlier", "postponed by 10 days": a relative move, or a question when the direction is unclear. */
function dateShift(clause: string): ClauseResult | null {
  const shift = /(\d+)\s*(day|week|fortnight|month)s?\b/.exec(clause);
  if (!shift?.[2]) return null;
  const days = Number(shift[1]) * (UNIT_DAYS[shift[2]] ?? 1);
  if (EARLIER.test(clause) || /\bbring\w* (?:it )?forward\b/.test(clause)) {
    return found({ kind: 'date', mode: 'shift', days: -days });
  }
  if (LATER.test(clause)) return found({ kind: 'date', mode: 'shift', days });
  return DATE_VERB.test(clause) ? ask('Should the event move earlier or later?') : NOTHING;
}

function parseDate(clause: string, today: IsoDate): ClauseResult {
  const shift = dateShift(clause);
  if (shift) return shift;
  const explicit = parseExplicitDate(clause, today);
  if (explicit) return found({ kind: 'date', mode: 'set', date: explicit });
  if (/\b(postpone\w*|prepone\w*|reschedul\w*|earlier|later|new date)\b/.test(clause)) {
    return ask('What is the new date, or how many days earlier or later?');
  }
  return NOTHING;
}

/** Parses free text into structured changes plus any clarifying questions. Never throws. */
export function parseChangeText(input: string, today: IsoDate): ParsedChange {
  const text = normalizeNumbers(input.slice(0, LIMITS.maxChangeText));
  const changes: Change[] = [];
  const clarifications = new Set<string>();
  const allowLooseGuestSet = !NEGATION.test(text);
  for (const clause of splitClauses(text)) {
    const budget = parseBudget(clause);
    if (budget.change) changes.push(budget.change);
    if (budget.clarification) clarifications.add(budget.clarification);
    if (budget.change || budget.clarification) continue;

    const guests = parseGuests(clause, allowLooseGuestSet);
    if (guests) changes.push(guests);

    const date = parseDate(clause, today);
    if (date.change) changes.push(date.change);
    if (date.clarification) clarifications.add(date.clarification);
  }
  return { changes, clarifications: [...clarifications] };
}
