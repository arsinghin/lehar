/** The "Add a quote" form as data: its fields, and the rules that turn them into a saved quote. */
import type { Category } from '../../core/constants/enums';
import { LIMITS } from '../../core/constants/limits';
import type { Quote } from '../../core/schemas';
import { checkQuoteAmount, parseWholeNumber } from '../../core/validation';

export interface QuoteDraft {
  vendorLabel: string;
  amount: string;
  guestsCovered: string;
  inclusions: string[];
  notes: string;
}

export type QuoteDraftErrors = Partial<Record<'vendorLabel' | 'amount' | 'guestsCovered', string>>;

export const EMPTY_QUOTE_DRAFT: QuoteDraft = {
  vendorLabel: '',
  amount: '',
  guestsCovered: '',
  inclusions: [],
  notes: '',
};

/** A valid quote, or the message for each field that needs fixing. */
export function quoteFromDraft(
  draft: QuoteDraft,
  category: Category,
  id: string,
): { ok: true; quote: Quote } | { ok: false; errors: QuoteDraftErrors } {
  const errors: QuoteDraftErrors = {};
  const vendorLabel = draft.vendorLabel.trim();
  if (!vendorLabel) errors.vendorLabel = 'Give the vendor a name or label.';
  const amount = checkQuoteAmount(draft.amount);
  if (!amount.ok) errors.amount = amount.message;
  const coveredText = draft.guestsCovered.trim();
  const guestsCovered = coveredText ? parseWholeNumber(coveredText, LIMITS.maxGuests) : null;
  if (coveredText && guestsCovered === null)
    errors.guestsCovered = 'Enter a whole number of guests.';

  if (!amount.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    quote: {
      id,
      category,
      vendorLabel: vendorLabel.slice(0, LIMITS.maxQuoteLabel),
      amount: amount.value,
      guestsCovered,
      inclusions: draft.inclusions,
      notes: draft.notes.trim().slice(0, LIMITS.maxQuoteNotes),
      status: 'received',
    },
  };
}
