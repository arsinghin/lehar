/**
 * Builds the minimal, non-identifying context sent to the AI from a full profile.
 * Title, notes and exact budget never leave the browser.
 */
import { CATEGORIES } from './constants/enums.js';
import {
  budgetBand,
  type IdeaContext,
  type ParseChangeRequest,
  type VendorQuestionsRequest,
} from './contract.js';
import { monthOf, type IsoDate } from './dates.js';
import type { Category } from './constants/enums.js';
import type { EventProfile } from './schemas.js';

export function topPriorities(profile: EventProfile, count = 3): Category[] {
  return [...CATEGORIES]
    .filter((category) => !profile.excludedCategories.includes(category))
    .sort(
      (a, b) =>
        profile.priorities[b] - profile.priorities[a] ||
        CATEGORIES.indexOf(a) - CATEGORIES.indexOf(b),
    )
    .slice(0, count);
}

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
      tier: profile.categoryTiers[category] ?? profile.tier,
      ageGroups: [...profile.ageGroups],
      diets: [...profile.diets],
      accessNeeds: [...profile.accessNeeds],
    },
  };
}
