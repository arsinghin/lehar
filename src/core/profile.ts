import {
  CATEGORIES,
  type Category,
  type EventType,
  type Priority,
  type Tier,
} from './constants/enums.js';
import { BASE_RATES, DEFAULT_CONTINGENCY_PCT } from './constants/rates.js';
import type { EventProfile } from './schemas.js';

/** Fields that a change, a trade-off or a what-if edit is allowed to touch. */
export type ProfilePatch = Partial<
  Pick<
    EventProfile,
    | 'guests'
    | 'budget'
    | 'eventDate'
    | 'tier'
    | 'categoryTiers'
    | 'excludedCategories'
    | 'contingencyPct'
    | 'rateOverrides'
    | 'priorities'
    | 'protectedCategories'
    | 'lockGuestCount'
  >
>;

const DEFAULT_PRIORITIES: Record<EventType, Record<Category, Priority>> = {
  wedding: {
    venue: 4,
    catering: 5,
    decor: 3,
    photo: 4,
    entertainment: 2,
    attire: 3,
    gifts: 2,
    logistics: 3,
  },
  birthday: {
    venue: 3,
    catering: 4,
    decor: 4,
    photo: 3,
    entertainment: 4,
    attire: 1,
    gifts: 3,
    logistics: 2,
  },
  community: {
    venue: 3,
    catering: 4,
    decor: 3,
    photo: 2,
    entertainment: 4,
    attire: 1,
    gifts: 2,
    logistics: 5,
  },
};

/** Categories that normally apply to this kind of event (birthdays rarely budget for outfits). */
export function relevantCategories(eventType: EventType): Category[] {
  const rates = BASE_RATES[eventType];
  return CATEGORIES.filter((category) => rates[category] !== undefined);
}

/** Starting priorities for an event type, before the host rates anything. */
export function defaultPriorities(eventType: EventType): Record<Category, Priority> {
  return { ...DEFAULT_PRIORITIES[eventType] };
}

export interface ProfileSeed {
  eventType: EventType;
  eventDate: string;
  guests: number;
  budget: number;
  tier?: Tier;
  title?: string;
  city?: string;
}

/** A complete, valid profile with sensible defaults for everything the seed does not specify. */
export function createProfile(seed: ProfileSeed): EventProfile {
  return {
    eventType: seed.eventType,
    title: seed.title ?? '',
    eventDate: seed.eventDate,
    city: seed.city ?? '',
    guests: seed.guests,
    budget: seed.budget,
    tier: seed.tier ?? 'standard',
    priorities: defaultPriorities(seed.eventType),
    protectedCategories: [],
    lockGuestCount: false,
    categoryTiers: {},
    excludedCategories: [],
    rateOverrides: {},
    contingencyPct: DEFAULT_CONTINGENCY_PCT,
    mustHaves: [],
    ageGroups: ['adults'],
    diets: [],
    accessNeeds: [],
    culture: '',
    notes: '',
  };
}

/** Applies a patch immutably. Map-shaped fields are merged, while arrays and scalars are replaced. */
export function applyProfilePatch(profile: EventProfile, patch: ProfilePatch): EventProfile {
  return {
    ...profile,
    ...patch,
    categoryTiers: { ...profile.categoryTiers, ...patch.categoryTiers },
    rateOverrides: { ...profile.rateOverrides, ...patch.rateOverrides },
    priorities: { ...profile.priorities, ...patch.priorities },
  };
}

/** A category's style: its own setting, or the plan's overall style. */
export function effectiveTier(profile: EventProfile, category: Category): Tier {
  return profile.categoryTiers[category] ?? profile.tier;
}

/** A short display title, falling back to the event type. */
export function displayTitle(profile: EventProfile): string {
  if (profile.title.trim()) return profile.title.trim();
  const base = {
    wedding: 'Your wedding',
    birthday: 'Your birthday party',
    community: 'Your community event',
  };
  return base[profile.eventType];
}
