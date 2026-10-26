/**
 * Intake wizard state and validation, kept out of the component so every rule is unit-testable.
 * The wizard asks the practical questions first (occasion, date, guests, budget, experience,
 * priorities, must-haves, people) before any plan is built.
 */
import { LIMITS } from '../../core/constants/limits';
import type {
  AccessNeed,
  AgeGroup,
  Category,
  Diet,
  EventType,
  Priority,
  Tier,
} from '../../core/constants/enums';
import { addDays, diffDays, isValidIsoDate } from '../../core/dates';
import { formatInr, parseInrAmount } from '../../core/money';
import { createProfile, defaultPriorities, relevantCategories } from '../../core/profile';
import { EventProfileSchema, type EventProfile } from '../../core/schemas';
import type { FieldError } from '../../components/ErrorSummary';

export interface IntakeDraft {
  eventType: EventType;
  title: string;
  eventDate: string;
  city: string;
  guests: string;
  budget: string;
  tier: Tier;
  priorities: Record<Category, Priority>;
  protectedCategories: Category[];
  lockGuestCount: boolean;
  ageGroups: AgeGroup[];
  diets: Diet[];
  accessNeeds: AccessNeed[];
  culture: string;
  mustHaves: string;
}

export const STEPS = [
  { id: 'occasion', title: 'The occasion' },
  { id: 'size', title: 'Guests and budget' },
  { id: 'priorities', title: 'What matters most' },
  { id: 'people', title: 'Your guests’ needs' },
  { id: 'review', title: 'Review' },
] as const;

export type StepIndex = 0 | 1 | 2 | 3 | 4;

export const FIELD_IDS = {
  eventType: 'intake-event-type',
  title: 'intake-title',
  eventDate: 'intake-date',
  city: 'intake-city',
  guests: 'intake-guests',
  budget: 'intake-budget',
  tier: 'intake-tier',
  mustHaves: 'intake-must-haves',
  culture: 'intake-culture',
} as const;

const DEFAULT_LEAD_DAYS: Record<EventType, number> = { wedding: 120, birthday: 30, community: 60 };

export function initialDraft(today: string, eventType: EventType = 'wedding'): IntakeDraft {
  return {
    eventType,
    title: '',
    eventDate: addDays(today, DEFAULT_LEAD_DAYS[eventType]),
    city: '',
    guests: '',
    budget: '',
    tier: 'standard',
    priorities: defaultPriorities(eventType),
    protectedCategories: [],
    lockGuestCount: false,
    ageGroups: ['adults'],
    diets: [],
    accessNeeds: [],
    culture: '',
    mustHaves: '',
  };
}

/** Switching the event type resets type-specific defaults but keeps everything else the host typed. */
export function withEventType(
  draft: IntakeDraft,
  eventType: EventType,
  today: string,
): IntakeDraft {
  if (draft.eventType === eventType) return draft;
  const relevant = new Set(relevantCategories(eventType));
  return {
    ...draft,
    eventType,
    eventDate: draft.eventDate || addDays(today, DEFAULT_LEAD_DAYS[eventType]),
    priorities: defaultPriorities(eventType),
    protectedCategories: draft.protectedCategories.filter((category) => relevant.has(category)),
  };
}

export function parseGuests(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, '');
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function parseMustHaves(value: string): string[] {
  return value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** Human preview of a typed budget, e.g. "8 lakh" → "= ₹8,00,000". */
export function budgetPreview(value: string): string | null {
  const amount = parseInrAmount(value);
  return amount === null ? null : `= ${formatInr(amount)}`;
}

export function validateStep(step: StepIndex, draft: IntakeDraft, today: string): FieldError[] {
  const errors: FieldError[] = [];
  if (step === 0) {
    if (!isValidIsoDate(draft.eventDate)) {
      errors.push({ fieldId: FIELD_IDS.eventDate, message: 'Enter the event date.' });
    } else if (diffDays(draft.eventDate, today) < 0) {
      errors.push({
        fieldId: FIELD_IDS.eventDate,
        message: 'The event date cannot be in the past.',
      });
    } else if (diffDays(draft.eventDate, today) > LIMITS.maxHorizonDays) {
      errors.push({
        fieldId: FIELD_IDS.eventDate,
        message: 'Lehar plans up to two years ahead.',
      });
    }
    if (draft.title.length > LIMITS.maxTitle) {
      errors.push({
        fieldId: FIELD_IDS.title,
        message: `Keep the name under ${LIMITS.maxTitle} characters.`,
      });
    }
    if (draft.city.length > LIMITS.maxCity) {
      errors.push({
        fieldId: FIELD_IDS.city,
        message: `Keep the city under ${LIMITS.maxCity} characters.`,
      });
    }
  }
  if (step === 1) {
    const guests = parseGuests(draft.guests);
    if (guests === null)
      errors.push({
        fieldId: FIELD_IDS.guests,
        message: 'Enter the number of guests as a whole number.',
      });
    else if (guests < LIMITS.minGuests || guests > LIMITS.maxGuests) {
      errors.push({
        fieldId: FIELD_IDS.guests,
        message: `Guests must be between ${LIMITS.minGuests} and ${LIMITS.maxGuests.toLocaleString('en-IN')}.`,
      });
    }
    const budget = parseInrAmount(draft.budget);
    if (budget === null)
      errors.push({
        fieldId: FIELD_IDS.budget,
        message: 'Enter a budget, for example “8 lakh” or “80000”.',
      });
    else if (budget < LIMITS.minBudget || budget > LIMITS.maxBudget) {
      errors.push({
        fieldId: FIELD_IDS.budget,
        message: `The budget must be between ${formatInr(LIMITS.minBudget)} and ${formatInr(LIMITS.maxBudget)}.`,
      });
    }
  }
  if (step === 3) {
    const mustHaves = parseMustHaves(draft.mustHaves);
    if (mustHaves.length > LIMITS.maxMustHaves) {
      errors.push({
        fieldId: FIELD_IDS.mustHaves,
        message: `List up to ${LIMITS.maxMustHaves} must-haves.`,
      });
    } else if (mustHaves.some((item) => item.length > LIMITS.maxMustHaveLength)) {
      errors.push({
        fieldId: FIELD_IDS.mustHaves,
        message: `Keep each must-have under ${LIMITS.maxMustHaveLength} characters.`,
      });
    }
    if (draft.culture.length > LIMITS.maxCulture) {
      errors.push({
        fieldId: FIELD_IDS.culture,
        message: `Keep this under ${LIMITS.maxCulture} characters.`,
      });
    }
  }
  return errors;
}

export function validateAll(draft: IntakeDraft, today: string): FieldError[] {
  return ([0, 1, 2, 3] as const).flatMap((step) => validateStep(step, draft, today));
}

/** Builds the validated profile, or null if anything is invalid. */
export function draftToProfile(draft: IntakeDraft, today: string): EventProfile | null {
  if (validateAll(draft, today).length > 0) return null;
  const guests = parseGuests(draft.guests);
  const budget = parseInrAmount(draft.budget);
  if (guests === null || budget === null) return null;
  const profile: EventProfile = {
    ...createProfile({
      eventType: draft.eventType,
      eventDate: draft.eventDate,
      guests,
      budget,
      tier: draft.tier,
      title: draft.title.trim(),
      city: draft.city.trim(),
    }),
    priorities: draft.priorities,
    protectedCategories: draft.protectedCategories,
    lockGuestCount: draft.lockGuestCount,
    ageGroups: draft.ageGroups,
    diets: draft.diets,
    accessNeeds: draft.accessNeeds,
    culture: draft.culture.trim(),
    mustHaves: parseMustHaves(draft.mustHaves),
  };
  const parsed = EventProfileSchema.safeParse(profile);
  return parsed.success ? parsed.data : null;
}
