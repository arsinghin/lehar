/** Applies parsed changes to the plan's current values and validates the results. */
import { LIMITS } from '../constants/limits.js';
import { addDays, diffDays, type IsoDate } from '../dates.js';
import { formatInr } from '../money.js';
import type { ProfilePatch } from '../profile.js';
import type { Change } from './parseChange.js';

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

interface Values {
  guests: number;
  budget: number;
  eventDate: IsoDate;
}

function applyChange(values: Values, change: Change): Values {
  switch (change.kind) {
    case 'guests':
      return {
        ...values,
        guests: change.mode === 'set' ? change.value : values.guests + change.value,
      };
    case 'budget': {
      if (change.mode === 'set') return { ...values, budget: change.value };
      if (change.mode === 'delta') return { ...values, budget: values.budget + change.value };
      return { ...values, budget: Math.round(values.budget * (1 + change.value / 100)) };
    }
    case 'date':
      return {
        ...values,
        eventDate: change.mode === 'set' ? change.date : addDays(values.eventDate, change.days),
      };
  }
}

function guestsError(guests: number): string | null {
  if (guests >= LIMITS.minGuests && guests <= LIMITS.maxGuests) return null;
  return `Guest count must be between ${String(LIMITS.minGuests)} and ${String(LIMITS.maxGuests)} (got ${String(guests)}).`;
}

function budgetError(budget: number): string | null {
  if (budget >= LIMITS.minBudget && budget <= LIMITS.maxBudget) return null;
  return `Budget must be between ${formatInr(LIMITS.minBudget)} and ${formatInr(LIMITS.maxBudget)}.`;
}

function dateError(eventDate: IsoDate, today: IsoDate): string | null {
  const fromToday = diffDays(eventDate, today);
  if (fromToday < 0) return 'The new date would be in the past.';
  if (fromToday > LIMITS.maxHorizonDays) return 'The new date is more than two years away.';
  return null;
}

/** Applies parsed changes to the current values, validating every result. */
export function resolveChanges(changes: readonly Change[], context: ChangeContext): ResolvedChange {
  const next = changes.reduce(applyChange, {
    guests: context.guests,
    budget: context.budget,
    eventDate: context.eventDate,
  });
  const patch: ProfilePatch = {};
  const summary: string[] = [];
  const errors: string[] = [];
  const record = (error: string | null, apply: () => void, line: string) => {
    if (error) errors.push(error);
    else {
      apply();
      summary.push(line);
    }
  };
  if (next.guests !== context.guests) {
    record(
      guestsError(next.guests),
      () => (patch.guests = next.guests),
      `Guests: ${String(context.guests)} → ${String(next.guests)}`,
    );
  }
  if (next.budget !== context.budget) {
    record(
      budgetError(next.budget),
      () => (patch.budget = next.budget),
      `Budget: ${formatInr(context.budget)} → ${formatInr(next.budget)}`,
    );
  }
  if (next.eventDate !== context.eventDate) {
    record(
      dateError(next.eventDate, context.today),
      () => (patch.eventDate = next.eventDate),
      `Date: ${context.eventDate} → ${next.eventDate}`,
    );
  }
  return { patch, summary, errors };
}
