/**
 * Zod schemas are the single source of truth for every persisted or transmitted shape.
 * Types are inferred from them, so validation and typing can never drift apart.
 */
import * as z from 'zod/mini';

import {
  ACCESS_NEEDS,
  AGE_GROUPS,
  AI_SOURCES,
  CATEGORIES,
  DIETS,
  EVENT_TYPES,
  PRIORITIES,
  QUOTE_STATUSES,
  TIERS,
} from './constants/enums.js';
import { LIMITS } from './constants/limits.js';
import { isValidIsoDate } from './dates.js';

export const IsoDateSchema = z
  .string()
  .check(z.refine(isValidIsoDate, 'Enter a valid date (YYYY-MM-DD).'));

export const EventTypeSchema = z.enum(EVENT_TYPES);
export const TierSchema = z.enum(TIERS);
export const CategorySchema = z.enum(CATEGORIES);
export const PrioritySchema = z.literal(PRIORITIES);

const boundedText = (max: number) => z.string().check(z.trim(), z.maxLength(max));
const wholeNumber = (min: number, max: number) => z.number().check(z.int(), z.gte(min), z.lte(max));

export const RateSchema = z.strictObject({
  perGuest: z.number().check(z.gte(0), z.lte(LIMITS.maxRatePerGuest)),
  fixed: z.number().check(z.gte(0), z.lte(LIMITS.maxRateFixed)),
});

export const EventProfileSchema = z.strictObject({
  eventType: EventTypeSchema,
  title: boundedText(LIMITS.maxTitle),
  eventDate: IsoDateSchema,
  city: boundedText(LIMITS.maxCity),
  guests: wholeNumber(LIMITS.minGuests, LIMITS.maxGuests),
  budget: wholeNumber(LIMITS.minBudget, LIMITS.maxBudget),
  tier: TierSchema,
  priorities: z.record(CategorySchema, PrioritySchema),
  protectedCategories: z.array(CategorySchema).check(z.maxLength(CATEGORIES.length)),
  lockGuestCount: z.boolean(),
  categoryTiers: z.partialRecord(CategorySchema, TierSchema),
  excludedCategories: z.array(CategorySchema).check(z.maxLength(CATEGORIES.length)),
  rateOverrides: z.partialRecord(CategorySchema, RateSchema),
  contingencyPct: wholeNumber(0, LIMITS.maxContingencyPct),
  mustHaves: z
    .array(boundedText(LIMITS.maxMustHaveLength).check(z.minLength(1)))
    .check(z.maxLength(LIMITS.maxMustHaves)),
  ageGroups: z.array(z.enum(AGE_GROUPS)).check(z.maxLength(AGE_GROUPS.length)),
  diets: z.array(z.enum(DIETS)).check(z.maxLength(DIETS.length)),
  accessNeeds: z.array(z.enum(ACCESS_NEEDS)).check(z.maxLength(ACCESS_NEEDS.length)),
  culture: boundedText(LIMITS.maxCulture),
  notes: boundedText(LIMITS.maxNotes),
});
export type EventProfile = z.infer<typeof EventProfileSchema>;

export const QuoteSchema = z.strictObject({
  id: z.string().check(z.minLength(1), z.maxLength(40)),
  category: CategorySchema,
  vendorLabel: boundedText(LIMITS.maxQuoteLabel).check(z.minLength(1)),
  amount: wholeNumber(0, LIMITS.maxBudget),
  guestsCovered: z.nullable(wholeNumber(0, LIMITS.maxGuests)),
  inclusions: z.array(boundedText(60)).check(z.maxLength(12)),
  notes: boundedText(LIMITS.maxQuoteNotes),
  status: z.enum(QUOTE_STATUSES),
});
export type Quote = z.infer<typeof QuoteSchema>;

export const TaskProgressSchema = z.strictObject({
  done: z.boolean(),
  delayDays: wholeNumber(0, LIMITS.maxDelayDays),
});
export type TaskProgress = z.infer<typeof TaskProgressSchema>;

export const IdeaSchema = z.strictObject({
  title: boundedText(70).check(z.minLength(1)),
  summary: boundedText(260).check(z.minLength(1)),
  decor: boundedText(200),
  food: boundedText(200),
  activity: boundedText(200),
  whyItFits: boundedText(240),
  costLevel: z.enum(['lower', 'similar', 'higher']),
});
export type Idea = z.infer<typeof IdeaSchema>;

export const AiSourceSchema = z.enum(AI_SOURCES);

export const IdeaSetSchema = z.strictObject({
  items: z.array(IdeaSchema).check(z.minLength(1), z.maxLength(3)),
  source: AiSourceSchema,
  refinedWith: z.optional(boundedText(LIMITS.maxRefineText)),
});
export type IdeaSet = z.infer<typeof IdeaSetSchema>;

export const VendorQuestionSetSchema = z.strictObject({
  questions: z.array(boundedText(200)).check(z.maxLength(8)),
  source: AiSourceSchema,
});
export type VendorQuestionSet = z.infer<typeof VendorQuestionSetSchema>;

export const PlanStateSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().check(z.minLength(1), z.maxLength(40)),
  createdAt: z.string().check(z.maxLength(40)),
  /** Planning start date. Ideal lead times are compressed against this, not against "today". */
  startDate: IsoDateSchema,
  isDemo: z.boolean(),
  profile: EventProfileSchema,
  progress: z.record(z.string().check(z.maxLength(40)), TaskProgressSchema),
  quotes: z.array(QuoteSchema).check(z.maxLength(LIMITS.maxQuotes)),
  ideas: z.nullable(IdeaSetSchema),
  vendorQuestions: z.partialRecord(CategorySchema, VendorQuestionSetSchema),
});
export type PlanState = z.infer<typeof PlanStateSchema>;

export const SnapshotSchema = z.strictObject({
  at: z.string().check(z.maxLength(40)),
  reason: boundedText(160),
  plan: PlanStateSchema,
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

export const PersistedStoreSchema = z.strictObject({
  storeVersion: z.literal(1),
  plan: z.nullable(PlanStateSchema),
  past: z.array(SnapshotSchema).check(z.maxLength(LIMITS.maxHistory)),
});
export type PersistedStore = z.infer<typeof PersistedStoreSchema>;
