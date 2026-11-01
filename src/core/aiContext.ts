/**
 * Builds the minimal, non-identifying context sent to the AI from a full profile.
 * Title, notes and exact budget never leave the browser.
 */
import { CATEGORIES, type Category, type EventType } from './constants/enums.js';
import { LIMITS } from './constants/limits.js';
import type {
  BudgetBand,
  IdeaContext,
  ParseChangeRequest,
  VendorQuestionsRequest,
} from './contract.js';
import { monthOf, type IsoDate } from './dates.js';
import { effectiveTier } from './profile.js';
import type { EventProfile } from './schemas.js';

/** Rupees-per-guest thresholds separating tight / moderate / comfortable budgets. */
const BAND_THRESHOLDS: Record<EventType, readonly [number, number]> = {
  wedding: [2_500, 6_000],
  birthday: [1_200, 3_000],
  community: [400, 1_200],
};

/** Budget band from rupees per guest, so the model sees the "feel" of the budget and not the amount. */
export function budgetBand(budget: number, guests: number, eventType: EventType): BudgetBand {
  const perGuest = budget / Math.max(1, guests);
  const [tightBelow, comfortableFrom] = BAND_THRESHOLDS[eventType];
  if (perGuest < tightBelow) return 'tight';
  if (perGuest < comfortableFrom) return 'moderate';
  return 'comfortable';
}

/** The host's highest-rated categories, best first (ties keep the standard category order). */
export function topPriorities(
  profile: EventProfile,
  count: number = LIMITS.maxTopPriorities,
): Category[] {
  return [...CATEGORIES]
    .filter((category) => !profile.excludedCategories.includes(category))
    .sort(
      (a, b) =>
        profile.priorities[b] - profile.priorities[a] ||
        CATEGORIES.indexOf(a) - CATEGORIES.indexOf(b),
    )
    .slice(0, count);
}

/** Context for idea requests: who is coming and how the budget feels, never names or amounts. */
export function toIdeaContext(profile: EventProfile): IdeaContext {
  return {
    eventType: profile.eventType,
    guests: profile.guests,
    tier: profile.tier,
    budgetBand: budgetBand(profile.budget, profile.guests, profile.eventType),
    month: monthOf(profile.eventDate),
    city: profile.city,
    ageGroups: [...profile.ageGroups],
    diets: [...profile.diets],
    accessNeeds: [...profile.accessNeeds],
    culture: profile.culture,
    mustHaves: [...profile.mustHaves],
    topPriorities: topPriorities(profile),
  };
}

/** A free-text change request with only the numbers the model needs to interpret it. */
export function toParseChangeRequest(
  profile: EventProfile,
  text: string,
  today: IsoDate,
): ParseChangeRequest {
  return {
    task: 'parseChange',
    text,
    context: {
      eventType: profile.eventType,
      guests: profile.guests,
      budget: profile.budget,
      eventDate: profile.eventDate,
      today,
    },
  };
}

/** A vendor-questions request for one category. */
export function toVendorQuestionsRequest(
  profile: EventProfile,
  category: Category,
): VendorQuestionsRequest {
  return {
    task: 'vendorQuestions',
    category,
    context: {
      eventType: profile.eventType,
      guests: profile.guests,
      tier: effectiveTier(profile, category),
      ageGroups: [...profile.ageGroups],
      diets: [...profile.diets],
      accessNeeds: [...profile.accessNeeds],
    },
  };
}
