/**
 * Deterministic natural-language change parser (English, Indian number conventions).
 *
 * Handles combined changes ("we have 50 more guests, the budget is down 10%, and the event is
 * 2 weeks earlier") without any AI call. When the text is vague ("the budget decreased a bit") it
 * returns a clarifying question instead of guessing. The AI is only consulted when nothing is understood.
 */
import { LIMITS } from '../constants/limits.js';
import { addDays, diffDays, isoFromParts, type IsoDate } from '../dates.js';
import { AMOUNT_PATTERN, amountFromMatch, formatInr } from '../money.js';
import type { ProfilePatch } from '../profile.js';

export type Change =
  | { kind: 'guests'; mode: 'delta' | 'set'; value: number }
  | { kind: 'budget'; mode: 'delta' | 'set' | 'percent'; value: number }
  | { kind: 'date'; mode: 'shift'; days: number }
  | { kind: 'date'; mode: 'set'; date: IsoDate };

export interface ParsedChange {
  changes: Change[];
  clarifications: string[];
}

export interface ChangeContext {
  guests: number;
  budget: number;
  eventDate: IsoDate;
  today: IsoDate;
}

export interface ResolvedChange {
  patch: ProfilePatch;
  /** Human-readable "from → to" lines for the preview. */
  summary: string[];
  errors: string[];
}

const UNITS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const UNIT_INDEX = new Map(UNITS.map((word, index) => [word, index]));

const GUEST_NOUN = String.raw`(?:guests?|people|persons?|attendees|pax|invitees|relatives|friends|members|families)`;
const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const MONTH_RE = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;

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

/** Lower-cases and converts number words ("fifty", "twenty-five", "a week", "a couple of") to digits. */
export function normaliseNumbers(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\b(?:a\s+)?couple\s+of\b/g, '2')
    .replace(/\ba\s+(fortnight|day|week|month|lakh|lac|crore|hundred|thousand)\b/g, '1 $1')
    .replace(
      /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s-]+(one|two|three|four|five|six|seven|eight|nine))?\b/g,
      (_match, tens: string, unit: string | undefined) =>
        String((TENS[tens] ?? 0) + (unit ? (UNIT_INDEX.get(unit) ?? 0) : 0)),
    )
    .replace(
      /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/g,
      (word) => String(UNIT_INDEX.get(word) ?? word),
    )
    .replace(/\b(\d+)\s+hundred\b/g, (_m, n: string) => String(Number(n) * 100))
    .replace(/\bhundred\b/g, '100');
}

/** Splits text into clauses without breaking amounts such as "7,00,000" or "7.5 lakh". */
export function splitClauses(text: string): string[] {
  return text
    .split(/[;!?\n]|\.(?=\s|$)|,\s|\band\b|\balso\b|\bbut\b|\bwhile\b/)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
}

/** `allowLooseSet` enables the weakest pattern ("about 300 people"), which is skipped when the message contains a negation. */
function parseGuests(clause: string, allowLooseSet: boolean): Change | null {
  let m = new RegExp(
    String.raw`(\d+)\s+(more|extra|additional|new|fewer|less)\s+${GUEST_NOUN}`,
  ).exec(clause);
  if (m)
    return {
      kind: 'guests',
      mode: 'delta',
      value: (m[2] === 'fewer' || m[2] === 'less' ? -1 : 1) * Number(m[1]),
    };

  m = new RegExp(
    String.raw`${GUEST_NOUN}\s+(?:count\s+)?(?:is\s+|are\s+|has\s+|have\s+)?(?:gone\s+)?(up|increased|grew|grown|risen|rose|down|decreased|reduced|dropped)\s+(?:by\s+)?(\d+)`,
  ).exec(clause);
  if (m)
    return {
      kind: 'guests',
      mode: 'delta',
      value: (/up|increased|grew|grown|risen|rose/.test(m[1] ?? '') ? 1 : -1) * Number(m[2]),
    };

  m = new RegExp(
    String.raw`(?:\badd(?:ing|ed)?|\binvit(?:e|ing|ed)|\bplus|\+)\s*(?:another\s+)?(\d+)\s*(?:more\s+)?${GUEST_NOUN}`,
  ).exec(clause);
  if (m) return { kind: 'guests', mode: 'delta', value: Number(m[1]) };

  m = new RegExp(
    String.raw`(?:\bremov(?:e|ing|ed)|\bdrop(?:ping|ped)?|\bcut(?:ting)?|\bminus|-)\s*(\d+)\s*${GUEST_NOUN}`,
  ).exec(clause);
  if (m) return { kind: 'guests', mode: 'delta', value: -Number(m[1]) };

  m = new RegExp(
    String.raw`(?:guest\s*count|headcount|guests?|attendees|people)\s*(?:is|are|will\s+be|becomes|now|to|of|=|:)?\s*(?:now\s+)?(?:about|around|approx\.?|~)?\s*(\d+)\b(?!\s*(?:%|percent|days?|weeks?|months?|lakhs?|lacs?|crores?|k\b))`,
  ).exec(clause);
  if (m) return { kind: 'guests', mode: 'set', value: Number(m[1]) };

  // Negations ("my in-laws are not coming, about 40 people") are ambiguous, so leave them to the AI.
  if (!allowLooseSet) return null;
  m = new RegExp(
    String.raw`\b(?:expect\w*|now|total(?:\s+of)?|about|around|approximately|roughly|have|having|be|for)\s+(?:about\s+|around\s+|roughly\s+)?(\d+)\s+${GUEST_NOUN}\b`,
  ).exec(clause);
  if (m) return { kind: 'guests', mode: 'set', value: Number(m[1]) };
  return null;
}

const BUDGET_CLARIFY =
  'By how much did the budget change? For example: “budget down by ₹50,000” or “budget is now 7 lakh”.';

function parseBudget(clause: string): { change: Change | null; clarification: string | null } {
  const at = clause.search(/\b(budget|funds|money|spend(?:ing)?)\b/);
  if (at < 0) return { change: null, clarification: null };
  const text = clause.slice(Math.max(0, at - 30));
  if (/\b(same|unchanged|no change|not changed)\b/.test(text))
    return { change: null, clarification: null };
  const decrease = DECREASE.test(text);
  const increase = !decrease && INCREASE.test(text);
  const sign = decrease ? -1 : 1;

  const percent = /(\d+(?:\.\d+)?)\s*(?:%|percent|per\s*cent)/.exec(text);
  if (percent) {
    if (!decrease && !increase)
      return { change: null, clarification: 'Did the budget go up or down by that percentage?' };
    return {
      change: { kind: 'budget', mode: 'percent', value: sign * Number(percent[1]) },
      clarification: null,
    };
  }

  const amount = new RegExp(AMOUNT_PATTERN.source, 'i').exec(text);
  const value = amount?.[1] ? amountFromMatch(amount[1], amount[2]) : null;
  if (amount && value !== null) {
    const before = text.slice(0, amount.index);
    const hasUnitOrSymbol = Boolean(amount[2]) || /₹|rs|inr/.test(amount[0]);
    if (/\bto\s*$|\b(is|now|=|:|of|becomes|be)\s*$/.test(before) || (!decrease && !increase)) {
      if (value < LIMITS.minBudget) return { change: null, clarification: BUDGET_CLARIFY };
      return { change: { kind: 'budget', mode: 'set', value }, clarification: null };
    }
    if (value < 100 && !hasUnitOrSymbol) return { change: null, clarification: BUDGET_CLARIFY };
    return { change: { kind: 'budget', mode: 'delta', value: sign * value }, clarification: null };
  }
  if (decrease || increase) return { change: null, clarification: BUDGET_CLARIFY };
  return { change: null, clarification: null };
}

const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, fortnight: 14, month: 30 };

function inferYear(month: number, day: number, today: IsoDate): IsoDate | null {
  const year = Number(today.slice(0, 4));
  const thisYear = isoFromParts(year, month, day);
  if (thisYear && diffDays(thisYear, today) >= 0) return thisYear;
  return isoFromParts(year + 1, month, day);
}

/** Absolute dates: 2027-03-12, 12/03/2027 (day first, Indian style), 12 March, March 12 2027. */
export function parseExplicitDate(clause: string, today: IsoDate): IsoDate | null {
  let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(clause);
  if (m) return isoFromParts(Number(m[1]), Number(m[2]), Number(m[3]));

  m = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/.exec(clause);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (!m[3]) return inferYear(month, day, today);
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return isoFromParts(year, month, day);
  }

  const monthIndex = (name: string) =>
    MONTHS.findIndex((month) => month.startsWith(name.slice(0, 3))) + 1;
  m = new RegExp(
    String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH_RE}\b,?\s*(\d{4})?`,
  ).exec(clause);
  if (m?.[2]) {
    const day = Number(m[1]);
    const month = monthIndex(m[2]);
    return m[3] ? isoFromParts(Number(m[3]), month, day) : inferYear(month, day, today);
  }
  m = new RegExp(String.raw`\b${MONTH_RE}\s+(\d{1,2})(?:st|nd|rd|th)?\b,?\s*(\d{4})?`).exec(clause);
  if (m?.[1]) {
    const month = monthIndex(m[1]);
    const day = Number(m[2]);
    return m[3] ? isoFromParts(Number(m[3]), month, day) : inferYear(month, day, today);
  }
  return null;
}

function parseDate(
  clause: string,
  today: IsoDate,
): { change: Change | null; clarification: string | null } {
  const shift = /(\d+)\s*(day|week|fortnight|month)s?\b/.exec(clause);
  if (shift?.[2]) {
    const days = Number(shift[1]) * (UNIT_DAYS[shift[2]] ?? 1);
    if (EARLIER.test(clause) || /\bbring\w* (?:it )?forward\b/.test(clause)) {
      return { change: { kind: 'date', mode: 'shift', days: -days }, clarification: null };
    }
    if (LATER.test(clause)) {
      return { change: { kind: 'date', mode: 'shift', days }, clarification: null };
    }
    if (DATE_VERB.test(clause))
      return { change: null, clarification: 'Should the event move earlier or later?' };
    return { change: null, clarification: null };
  }
  const explicit = parseExplicitDate(clause, today);
  if (explicit)
    return { change: { kind: 'date', mode: 'set', date: explicit }, clarification: null };
  if (/\b(postpone\w*|prepone\w*|reschedul\w*|earlier|later|new date)\b/.test(clause)) {
    return {
      change: null,
      clarification: 'What is the new date, or how many days earlier or later?',
    };
  }
  return { change: null, clarification: null };
}

/** Parses free text into structured changes plus any clarifying questions. Never throws. */
export function parseChangeText(input: string, today: IsoDate): ParsedChange {
  const text = normaliseNumbers(input.slice(0, LIMITS.maxChangeText));
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

/** Applies parsed changes to the current values, validating every result. */
export function resolveChanges(changes: readonly Change[], context: ChangeContext): ResolvedChange {
  let guests = context.guests;
  let budget = context.budget;
  let eventDate = context.eventDate;
  for (const change of changes) {
    if (change.kind === 'guests')
      guests = change.mode === 'set' ? change.value : guests + change.value;
    else if (change.kind === 'budget') {
      if (change.mode === 'set') budget = change.value;
      else if (change.mode === 'delta') budget += change.value;
      else budget = Math.round(budget * (1 + change.value / 100));
    } else eventDate = change.mode === 'set' ? change.date : addDays(eventDate, change.days);
  }

  const patch: ProfilePatch = {};
  const summary: string[] = [];
  const errors: string[] = [];
  if (guests !== context.guests) {
    if (guests < LIMITS.minGuests || guests > LIMITS.maxGuests) {
      errors.push(
        `Guest count must be between ${LIMITS.minGuests} and ${LIMITS.maxGuests} (got ${guests}).`,
      );
    } else {
      patch.guests = guests;
      summary.push(`Guests: ${context.guests} → ${guests}`);
    }
  }
  if (budget !== context.budget) {
    if (budget < LIMITS.minBudget || budget > LIMITS.maxBudget) {
      errors.push(
        `Budget must be between ${formatInr(LIMITS.minBudget)} and ${formatInr(LIMITS.maxBudget)}.`,
      );
    } else {
      patch.budget = budget;
      summary.push(`Budget: ${formatInr(context.budget)} → ${formatInr(budget)}`);
    }
  }
  if (eventDate !== context.eventDate) {
    const fromToday = diffDays(eventDate, context.today);
    if (fromToday < 0) errors.push('The new date would be in the past.');
    else if (fromToday > LIMITS.maxHorizonDays)
      errors.push('The new date is more than two years away.');
    else {
      patch.eventDate = eventDate;
      summary.push(`Date: ${context.eventDate} → ${eventDate}`);
    }
  }
  return { patch, summary, errors };
}
