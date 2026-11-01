/**
 * Validation for numbers the host types, shared by every form so that the rules and the messages
 * are the same wherever guests, budgets or rates are entered.
 */
import { LIMITS } from './constants/limits.js';
import { formatInr, formatNumber, parseInrAmount } from './money.js';

/** "1,250" → 1250. Anything that is not a plain whole number (or is above `max`) gives null. */
export function parseWholeNumber(value: string, max = Number.MAX_SAFE_INTEGER): number | null {
  const digits = value.trim().replace(/,/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const number = Number(digits);
  return number <= max ? number : null;
}

/** A message tied to the id of the field it is about, so an error summary can link to it. */
export interface FieldError {
  fieldId: string;
  message: string;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

/** A guest count within the supported range. */
export function checkGuests(text: string): Checked<number> {
  const guests = parseWholeNumber(text);
  if (guests === null) {
    return { ok: false, message: 'Enter the number of guests as a whole number.' };
  }
  if (guests < LIMITS.minGuests || guests > LIMITS.maxGuests) {
    return {
      ok: false,
      message: `Guests must be between ${formatNumber(LIMITS.minGuests)} and ${formatNumber(LIMITS.maxGuests)}.`,
    };
  }
  return { ok: true, value: guests };
}

/** A total budget in rupees, typed in any Indian format ("8 lakh", "₹80,000"). */
export function checkBudget(text: string): Checked<number> {
  const budget = parseInrAmount(text);
  if (budget === null) {
    return { ok: false, message: 'Enter a budget, for example “8 lakh” or “80000”.' };
  }
  if (budget < LIMITS.minBudget || budget > LIMITS.maxBudget) {
    return {
      ok: false,
      message: `The budget must be between ${formatInr(LIMITS.minBudget)} and ${formatInr(LIMITS.maxBudget)}.`,
    };
  }
  return { ok: true, value: budget };
}

/** A vendor's quoted total: any positive amount up to the largest supported budget. */
export function checkQuoteAmount(text: string): Checked<number> {
  const amount = parseInrAmount(text);
  if (amount === null || amount <= 0 || amount > LIMITS.maxBudget) {
    return { ok: false, message: 'Enter the quoted total, for example “2.3 lakh”.' };
  }
  return { ok: true, value: amount };
}
