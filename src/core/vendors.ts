/**
 * Vendor coordination: requirement sheets, questions to ask, and quote comparison.
 * Lehar acts as the host's coordinator. It does not claim availability, invent vendors or
 * guess prices. Quotes are exactly what the host enters.
 */
import {
  ACCESS_NEED_LABELS,
  CATEGORY_LABELS,
  DIET_LABELS,
  TIER_LABELS,
  type Category,
} from './constants/enums.js';
import { VENDOR_QUESTION_LIMITS } from './constants/limits.js';
import { GENERIC_VENDOR_QUESTIONS, VENDOR_PROFILES } from './constants/vendors.js';
import { formatDate } from './dates.js';
import { formatInr, formatNumber } from './money.js';
import { effectiveTier } from './profile.js';
import type { BudgetLine } from './budget.js';
import type { EventProfile, Quote } from './schemas.js';

/** Order caterers to plan for a few more plates than the confirmed count. */
export const PLATE_BUFFER_RATIO = 1.05;

export interface VendorBrief {
  category: Category;
  label: string;
  target: number | null;
  requirements: string[];
  questions: readonly string[];
  inclusions: readonly string[];
  mapsQuery: string;
}

export interface QuoteRow {
  quote: Quote;
  perGuest: number | null;
  vsTarget: number | null;
  coversGuests: boolean | null;
  missingInclusions: string[];
  flags: string[];
}

export interface QuoteComparison {
  category: Category;
  rows: QuoteRow[];
  /** Lowest total among quotes that cover everyone and list no missing inclusions. */
  lowestCompleteId: string | null;
}

/** The questions used when the AI is unavailable: the category checklist, or generic ones. */
export function fallbackVendorQuestions(category: Category): string[] {
  const questions = VENDOR_PROFILES[category]?.questions ?? GENERIC_VENDOR_QUESTIONS;
  return questions.slice(0, VENDOR_QUESTION_LIMITS.asked);
}

function requirementsFor(profile: EventProfile, category: Category): string[] {
  const reqs = [
    `Date: ${formatDate(profile.eventDate)}${profile.city ? ` in ${profile.city}` : ''}`,
  ];
  const tier = TIER_LABELS[effectiveTier(profile, category)].toLowerCase();
  switch (category) {
    case 'venue':
      reqs.push(`Seating for at least ${formatNumber(profile.guests)} guests`);
      break;
    case 'catering': {
      const plates = Math.ceil(profile.guests * PLATE_BUFFER_RATIO);
      reqs.push(
        `About ${formatNumber(plates)} plates (${formatNumber(profile.guests)} guests + ${String(Math.round((PLATE_BUFFER_RATIO - 1) * 100))}% buffer)`,
      );
      if (profile.diets.length > 0) {
        reqs.push(`Menus needed: ${profile.diets.map((diet) => DIET_LABELS[diet]).join(', ')}`);
      }
      if (profile.ageGroups.includes('kids')) reqs.push('A mild kids’ menu');
      break;
    }
    case 'photo':
      reqs.push(`Coverage for ${formatNumber(profile.guests)} guests`);
      break;
    default:
      break;
  }
  if (category === 'venue' || category === 'logistics') {
    for (const need of profile.accessNeeds)
      reqs.push(`${ACCESS_NEED_LABELS[need]} must be available`);
    if (profile.ageGroups.includes('seniors'))
      reqs.push('Comfortable seating and a short walk for elders');
  }
  reqs.push(`Style: ${tier} package`);
  return reqs;
}

/** What to tell and ask a vendor in this category, built from the host's own profile. */
export function vendorBrief(profile: EventProfile, line: BudgetLine): VendorBrief | null {
  const vendor = VENDOR_PROFILES[line.category];
  if (!vendor) return null;
  return {
    category: line.category,
    label: CATEGORY_LABELS[line.category],
    target: line.estimate,
    requirements: requirementsFor(profile, line.category),
    questions: vendor.questions,
    inclusions: vendor.inclusions,
    mapsQuery: vendor.mapsQuery,
  };
}

/** Side-by-side quote comparison. It highlights what is still unclear and never ranks vendors by quality. */
export function compareQuotes(
  category: Category,
  quotes: readonly Quote[],
  guests: number,
  target: number | null,
): QuoteComparison {
  const inclusions = VENDOR_PROFILES[category]?.inclusions ?? [];
  const rows: QuoteRow[] = quotes
    .filter((quote) => quote.category === category)
    .map((quote) => {
      const missingInclusions = inclusions.filter((item) => !quote.inclusions.includes(item));
      const coversGuests = quote.guestsCovered === null ? null : quote.guestsCovered >= guests;
      const vsTarget = target === null ? null : quote.amount - target;
      const flags: string[] = [];
      if (coversGuests === false) {
        flags.push(
          `Covers ${formatNumber(quote.guestsCovered ?? 0)} of ${formatNumber(guests)} guests`,
        );
      }
      if (quote.guestsCovered === null) flags.push('Ask how many guests this covers');
      if (vsTarget !== null && vsTarget > 0)
        flags.push(`${formatInr(vsTarget)} above your estimate`);
      for (const item of missingInclusions) flags.push(`Clarify: ${item}`);
      return {
        quote,
        perGuest: guests > 0 ? Math.round(quote.amount / guests) : null,
        vsTarget,
        coversGuests,
        missingInclusions,
        flags,
      };
    });
  const complete = rows.filter(
    (row) => row.coversGuests === true && row.missingInclusions.length === 0,
  );
  const lowest = complete.reduce<QuoteRow | null>(
    (best, row) => (best === null || row.quote.amount < best.quote.amount ? row : best),
    null,
  );
  return { category, rows, lowestCompleteId: lowest?.quote.id ?? null };
}
