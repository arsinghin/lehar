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
import { addDays, diffDays, isValidIsoDate, type IsoDate } from '../../core/dates';
import { formatInr, parseInrAmount } from '../../core/money';
import { createProfile, defaultPriorities, relevantCategories } from '../../core/profile';
import { EventProfileSchema, type EventProfile } from '../../core/schemas';
import { checkBudget, checkGuests, parseWholeNumber, type FieldError } from '../../core/validation';

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

export type StepId = (typeof STEPS)[number]['id'];
/** The review step, where the plan is created. */
export const LAST_STEP = STEPS.length - 1;

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

/** An empty intake for an event type, dated a typical lead time from today. */
export function initialDraft(today: IsoDate, eventType: EventType = 'wedding'): IntakeDraft {
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
  today: IsoDate,
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

/** Must-haves typed one per line (or separated by commas or semicolons). */
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

function validateOccasion(draft: IntakeDraft, today: IsoDate): FieldError[] {
  const errors: FieldError[] = [];
  const dateError = eventDateError(draft.eventDate, today);
  if (dateError) errors.push({ fieldId: FIELD_IDS.eventDate, message: dateError });
  if (draft.title.length > LIMITS.maxTitle) {
    errors.push({
      fieldId: FIELD_IDS.title,
      message: `Keep the name under ${String(LIMITS.maxTitle)} characters.`,
    });
  }
  if (draft.city.length > LIMITS.maxCity) {
    errors.push({
      fieldId: FIELD_IDS.city,
      message: `Keep the city under ${String(LIMITS.maxCity)} characters.`,
    });
  }
  return errors;
}

function eventDateError(eventDate: string, today: IsoDate): string | null {
  if (!isValidIsoDate(eventDate)) return 'Enter the event date.';
  const daysAway = diffDays(eventDate, today);
  if (daysAway < 0) return 'The event date cannot be in the past.';
  if (daysAway > LIMITS.maxHorizonDays) return 'Lehar plans up to two years ahead.';
  return null;
}

function validateSize(draft: IntakeDraft): FieldError[] {
  const errors: FieldError[] = [];
  const guests = checkGuests(draft.guests);
  if (!guests.ok) errors.push({ fieldId: FIELD_IDS.guests, message: guests.message });
  const budget = checkBudget(draft.budget);
  if (!budget.ok) errors.push({ fieldId: FIELD_IDS.budget, message: budget.message });
  return errors;
}

function validatePeople(draft: IntakeDraft): FieldError[] {
  const errors: FieldError[] = [];
  const mustHaves = parseMustHaves(draft.mustHaves);
  if (mustHaves.length > LIMITS.maxMustHaves) {
    errors.push({
      fieldId: FIELD_IDS.mustHaves,
      message: `List up to ${String(LIMITS.maxMustHaves)} must-haves.`,
    });
  } else if (mustHaves.some((item) => item.length > LIMITS.maxMustHaveLength)) {
    errors.push({
      fieldId: FIELD_IDS.mustHaves,
      message: `Keep each must-have under ${String(LIMITS.maxMustHaveLength)} characters.`,
    });
  }
  if (draft.culture.length > LIMITS.maxCulture) {
    errors.push({
      fieldId: FIELD_IDS.culture,
      message: `Keep this under ${String(LIMITS.maxCulture)} characters.`,
    });
  }
  return errors;
}

const STEP_VALIDATORS: Record<StepId, (draft: IntakeDraft, today: IsoDate) => FieldError[]> = {
  occasion: validateOccasion,
  size: validateSize,
  priorities: () => [],
  people: validatePeople,
  review: () => [],
};

/** The errors that stop the host leaving step `step` (an index into STEPS). */
export function validateStep(step: number, draft: IntakeDraft, today: IsoDate): FieldError[] {
  const id = STEPS[step]?.id;
  return id ? STEP_VALIDATORS[id](draft, today) : [];
}

/** Errors across every step, used before the plan is created. */
export function validateAll(draft: IntakeDraft, today: IsoDate): FieldError[] {
  return STEPS.flatMap((_, step) => validateStep(step, draft, today));
}

/** Builds the validated profile, or null if anything is invalid. */
export function draftToProfile(draft: IntakeDraft, today: IsoDate): EventProfile | null {
  if (validateAll(draft, today).length > 0) return null;
  const guests = parseWholeNumber(draft.guests);
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
