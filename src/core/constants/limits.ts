/** Input bounds shared by client-side validation, persistence, the API contract and the AI prompts. */
export const LIMITS = {
  minGuests: 1,
  maxGuests: 5000,
  minBudget: 1000,
  maxBudget: 100_000_000,
  maxHorizonDays: 730,
  maxTitle: 80,
  maxCity: 60,
  maxCulture: 80,
  maxNotes: 300,
  maxMustHaves: 5,
  maxMustHaveLength: 60,
  maxQuotes: 40,
  maxQuoteLabel: 60,
  maxQuoteNotes: 200,
  maxInclusions: 12,
  maxInclusionLength: 60,
  maxChangeText: 300,
  maxRefineText: 200,
  maxClarification: 200,
  maxContingencyPct: 20,
  maxRatePerGuest: 100_000,
  maxRateFixed: 50_000_000,
  maxDelayDays: 120,
  maxHistory: 20,
  maxHistoryReason: 160,
  maxIdLength: 40,
  maxTopPriorities: 3,
} as const;

/** The free-text fields of an idea. */
export const IDEA_TEXT_FIELDS = [
  'title',
  'summary',
  'decor',
  'food',
  'activity',
  'whyItFits',
] as const;
export type IdeaTextField = (typeof IDEA_TEXT_FIELDS)[number];

/** Maximum length of each idea field: used by the schema, the sanitizer and the prompt. */
export const IDEA_TEXT_LIMITS: Readonly<Record<IdeaTextField, number>> = {
  title: 70,
  summary: 260,
  decor: 200,
  food: 200,
  activity: 200,
  whyItFits: 240,
};

/** Ideas returned per request. */
export const IDEAS_PER_SET = 3;

export const VENDOR_QUESTION_LIMITS = {
  /** How many questions the prompt asks for, and how many the fallback returns. */
  asked: 5,
  /** Accepted per AI answer: one more than asked, as models sometimes add a question. */
  maxPerAnswer: 6,
  /** Stored per category in a plan. */
  stored: 8,
  maxLength: 200,
  /** Shorter strings are fragments, not questions. */
  minLength: 10,
} as const;
