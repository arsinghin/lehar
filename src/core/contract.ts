/**
 * The contract between the browser and POST /api/ai.
 *
 * Requests carry only the minimum non-identifying context the model needs. There are no names,
 * titles, notes, phone numbers or emails. Idea requests see the budget only as a band. Responses are
 * validated with the same schemas on the server (after the model answers) and again in the browser.
 */
import * as z from 'zod/mini';

import {
  ACCESS_NEEDS,
  AGE_GROUPS,
  CATEGORIES,
  DIETS,
  EVENT_TYPES,
  TIERS,
} from './constants/enums.js';
import { LIMITS } from './constants/limits.js';
import { AiSourceSchema, IdeaSchema, IsoDateSchema } from './schemas.js';

const text = (max: number) => z.string().check(z.trim(), z.maxLength(max));
const int = (min: number, max: number) => z.number().check(z.int(), z.gte(min), z.lte(max));

export const BUDGET_BANDS = ['tight', 'moderate', 'comfortable'] as const;
export type BudgetBand = (typeof BUDGET_BANDS)[number];

export const IdeaContextSchema = z.strictObject({
  eventType: z.enum(EVENT_TYPES),
  guests: int(LIMITS.minGuests, LIMITS.maxGuests),
  tier: z.enum(TIERS),
  budgetBand: z.enum(BUDGET_BANDS),
  month: int(1, 12),
  city: text(LIMITS.maxCity),
  ageGroups: z.array(z.enum(AGE_GROUPS)).check(z.maxLength(AGE_GROUPS.length)),
  diets: z.array(z.enum(DIETS)).check(z.maxLength(DIETS.length)),
  accessNeeds: z.array(z.enum(ACCESS_NEEDS)).check(z.maxLength(ACCESS_NEEDS.length)),
  culture: text(LIMITS.maxCulture),
  mustHaves: z.array(text(LIMITS.maxMustHaveLength)).check(z.maxLength(LIMITS.maxMustHaves)),
  topPriorities: z.array(z.enum(CATEGORIES)).check(z.maxLength(3)),
});
export type IdeaContext = z.infer<typeof IdeaContextSchema>;

export const IdeasRequestSchema = z.strictObject({
  task: z.literal('ideas'),
  context: IdeaContextSchema,
  refine: z.optional(
    z.strictObject({
      ideaTitle: text(70),
      instruction: text(LIMITS.maxRefineText).check(z.minLength(2)),
    }),
  ),
});

export const ParseChangeRequestSchema = z.strictObject({
  task: z.literal('parseChange'),
  text: text(LIMITS.maxChangeText).check(z.minLength(2)),
  context: z.strictObject({
    eventType: z.enum(EVENT_TYPES),
    guests: int(LIMITS.minGuests, LIMITS.maxGuests),
    budget: int(LIMITS.minBudget, LIMITS.maxBudget),
    eventDate: IsoDateSchema,
    today: IsoDateSchema,
  }),
});

export const VendorQuestionsRequestSchema = z.strictObject({
  task: z.literal('vendorQuestions'),
  category: z.enum(CATEGORIES),
  context: z.strictObject({
    eventType: z.enum(EVENT_TYPES),
    guests: int(LIMITS.minGuests, LIMITS.maxGuests),
    tier: z.enum(TIERS),
    ageGroups: z.array(z.enum(AGE_GROUPS)).check(z.maxLength(AGE_GROUPS.length)),
    diets: z.array(z.enum(DIETS)).check(z.maxLength(DIETS.length)),
    accessNeeds: z.array(z.enum(ACCESS_NEEDS)).check(z.maxLength(ACCESS_NEEDS.length)),
  }),
});

export const AiRequestSchema = z.discriminatedUnion('task', [
  IdeasRequestSchema,
  ParseChangeRequestSchema,
  VendorQuestionsRequestSchema,
]);
export type AiRequest = z.infer<typeof AiRequestSchema>;
export type IdeasRequest = z.infer<typeof IdeasRequestSchema>;
export type ParseChangeRequest = z.infer<typeof ParseChangeRequestSchema>;
export type VendorQuestionsRequest = z.infer<typeof VendorQuestionsRequestSchema>;
export type AiTask = AiRequest['task'];

/* ---------- Model output schemas (also sent to the model as the JSON schema) ---------- */

export const IdeasOutputSchema = z.strictObject({
  ideas: z.array(IdeaSchema).check(z.minLength(1), z.maxLength(3)),
});
export type IdeasOutput = z.infer<typeof IdeasOutputSchema>;

/** A flat shape is easier for models to fill reliably than a discriminated union. */
export const ParseChangeOutputSchema = z.strictObject({
  guestsDelta: z.optional(int(-LIMITS.maxGuests, LIMITS.maxGuests)),
  guestsSet: z.optional(int(LIMITS.minGuests, LIMITS.maxGuests)),
  budgetDelta: z.optional(int(-LIMITS.maxBudget, LIMITS.maxBudget)),
  budgetSet: z.optional(int(LIMITS.minBudget, LIMITS.maxBudget)),
  budgetPercent: z.optional(z.number().check(z.gte(-90), z.lte(500))),
  dateShiftDays: z.optional(int(-LIMITS.maxHorizonDays, LIMITS.maxHorizonDays)),
  dateSet: z.optional(IsoDateSchema),
  clarification: z.optional(text(200)),
});
export type ParseChangeOutput = z.infer<typeof ParseChangeOutputSchema>;

export const VendorQuestionsOutputSchema = z.strictObject({
  questions: z.array(text(200).check(z.minLength(5))).check(z.minLength(1), z.maxLength(6)),
});
export type VendorQuestionsOutput = z.infer<typeof VendorQuestionsOutputSchema>;

export interface AiOutputByTask {
  ideas: IdeasOutput;
  parseChange: ParseChangeOutput;
  vendorQuestions: VendorQuestionsOutput;
}

export const AI_OUTPUT_SCHEMAS = {
  ideas: IdeasOutputSchema,
  parseChange: ParseChangeOutputSchema,
  vendorQuestions: VendorQuestionsOutputSchema,
} as const;

/* ---------- Response envelope ---------- */

export const AiErrorCodeSchema = z.enum([
  'method_not_allowed',
  'unsupported_media_type',
  'payload_too_large',
  'invalid_json',
  'invalid_request',
  'forbidden_origin',
  'rate_limited',
  'input_rejected',
  'internal_error',
]);
export type AiErrorCode = z.infer<typeof AiErrorCodeSchema>;

export const AiMetaSchema = z.strictObject({
  source: AiSourceSchema,
  model: z.nullable(text(80)),
  cached: z.boolean(),
  requestId: text(64),
});
export type AiMeta = z.infer<typeof AiMetaSchema>;

export const AiErrorBodySchema = z.strictObject({
  ok: z.literal(false),
  error: z.strictObject({ code: AiErrorCodeSchema, message: text(300) }),
  requestId: text(64),
});

export interface AiSuccessBody<T extends AiTask> {
  ok: true;
  task: T;
  data: AiOutputByTask[T];
  meta: AiMeta;
}

/** Rupees-per-guest thresholds separating tight / moderate / comfortable budgets. */
const BAND_THRESHOLDS: Record<(typeof EVENT_TYPES)[number], readonly [number, number]> = {
  wedding: [2_500, 6_000],
  birthday: [1_200, 3_000],
  community: [400, 1_200],
};

/** Budget band from rupees per guest, so the model sees the "feel" of the budget and not the amount. */
export function budgetBand(
  budget: number,
  guests: number,
  eventType: (typeof EVENT_TYPES)[number],
): BudgetBand {
  const perGuest = budget / Math.max(1, guests);
  const [tightBelow, comfortableFrom] = BAND_THRESHOLDS[eventType];
  if (perGuest < tightBelow) return 'tight';
  if (perGuest < comfortableFrom) return 'moderate';
  return 'comfortable';
}
