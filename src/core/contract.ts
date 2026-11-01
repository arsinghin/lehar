/**
 * The contract between the browser and POST /api/ai.
 *
 * Requests carry only the minimum non-identifying context the model needs. There are no names,
 * titles, notes, phone numbers or emails. Idea requests see the budget only as a band. Responses are
 * validated with the same schemas on the server (after the model answers) and again in the browser.
 */
import * as z from 'zod/mini';

import { CATEGORIES, EVENT_TYPES, TIERS } from './constants/enums.js';
import {
  IDEA_TEXT_LIMITS,
  IDEAS_PER_SET,
  LIMITS,
  VENDOR_QUESTION_LIMITS,
} from './constants/limits.js';
import {
  AccessNeedsSchema,
  AgeGroupsSchema,
  AiSourceSchema,
  boundedText as text,
  DietsSchema,
  IdeaSchema,
  IsoDateSchema,
  wholeNumber as int,
} from './schemas.js';

/** Range of budget changes, in percent, that the AI may report. */
const MAX_BUDGET_PERCENT_UP = 500;
const MAX_BUDGET_PERCENT_DOWN = -90;
const MAX_MODEL_NAME = 80;
const MAX_REQUEST_ID = 64;
const MAX_ERROR_MESSAGE = 300;

export const BUDGET_BANDS = ['tight', 'moderate', 'comfortable'] as const;
export type BudgetBand = (typeof BUDGET_BANDS)[number];

export const IdeaContextSchema = z.strictObject({
  eventType: z.enum(EVENT_TYPES),
  guests: int(LIMITS.minGuests, LIMITS.maxGuests),
  tier: z.enum(TIERS),
  budgetBand: z.enum(BUDGET_BANDS),
  month: int(1, 12),
  city: text(LIMITS.maxCity),
  ageGroups: AgeGroupsSchema,
  diets: DietsSchema,
  accessNeeds: AccessNeedsSchema,
  culture: text(LIMITS.maxCulture),
  mustHaves: z.array(text(LIMITS.maxMustHaveLength)).check(z.maxLength(LIMITS.maxMustHaves)),
  topPriorities: z.array(z.enum(CATEGORIES)).check(z.maxLength(LIMITS.maxTopPriorities)),
});
export type IdeaContext = z.infer<typeof IdeaContextSchema>;

export const IdeasRequestSchema = z.strictObject({
  task: z.literal('ideas'),
  context: IdeaContextSchema,
  refine: z.optional(
    z.strictObject({
      ideaTitle: text(IDEA_TEXT_LIMITS.title),
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
    ageGroups: AgeGroupsSchema,
    diets: DietsSchema,
    accessNeeds: AccessNeedsSchema,
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
/** The request for one task. The `task` member keeps the key and the request paired in generics. */
export type TaskRequest<T extends AiTask> = Extract<AiRequest, { task: T }> & { task: T };

/* ---------- Model output schemas (also sent to the model as the JSON schema) ---------- */

export const IdeasOutputSchema = z.strictObject({
  ideas: z.array(IdeaSchema).check(z.minLength(1), z.maxLength(IDEAS_PER_SET)),
});
export type IdeasOutput = z.infer<typeof IdeasOutputSchema>;

/** A flat shape is easier for models to fill reliably than a discriminated union. */
export const ParseChangeOutputSchema = z.strictObject({
  guestsDelta: z.optional(int(-LIMITS.maxGuests, LIMITS.maxGuests)),
  guestsSet: z.optional(int(LIMITS.minGuests, LIMITS.maxGuests)),
  budgetDelta: z.optional(int(-LIMITS.maxBudget, LIMITS.maxBudget)),
  budgetSet: z.optional(int(LIMITS.minBudget, LIMITS.maxBudget)),
  budgetPercent: z.optional(
    z.number().check(z.gte(MAX_BUDGET_PERCENT_DOWN), z.lte(MAX_BUDGET_PERCENT_UP)),
  ),
  dateShiftDays: z.optional(int(-LIMITS.maxHorizonDays, LIMITS.maxHorizonDays)),
  dateSet: z.optional(IsoDateSchema),
  clarification: z.optional(text(LIMITS.maxClarification)),
});
export type ParseChangeOutput = z.infer<typeof ParseChangeOutputSchema>;

export const VendorQuestionsOutputSchema = z.strictObject({
  questions: z
    .array(text(VENDOR_QUESTION_LIMITS.maxLength).check(z.minLength(1)))
    .check(z.minLength(1), z.maxLength(VENDOR_QUESTION_LIMITS.maxPerAnswer)),
});
export type VendorQuestionsOutput = z.infer<typeof VendorQuestionsOutputSchema>;

export interface AiOutputByTask {
  ideas: IdeasOutput;
  parseChange: ParseChangeOutput;
  vendorQuestions: VendorQuestionsOutput;
}

export const AI_OUTPUT_SCHEMAS: { readonly [T in AiTask]: z.ZodMiniType<AiOutputByTask[T]> } = {
  ideas: IdeasOutputSchema,
  parseChange: ParseChangeOutputSchema,
  vendorQuestions: VendorQuestionsOutputSchema,
};

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
  model: z.nullable(text(MAX_MODEL_NAME)),
  cached: z.boolean(),
  requestId: text(MAX_REQUEST_ID),
});
export type AiMeta = z.infer<typeof AiMetaSchema>;

export const AiErrorBodySchema = z.strictObject({
  ok: z.literal(false),
  error: z.strictObject({ code: AiErrorCodeSchema, message: text(MAX_ERROR_MESSAGE) }),
  requestId: text(MAX_REQUEST_ID),
});
export type AiErrorBody = z.infer<typeof AiErrorBodySchema>;

export interface AiSuccessBody<T extends AiTask> {
  ok: true;
  task: T;
  data: AiOutputByTask[T];
  meta: AiMeta;
}
