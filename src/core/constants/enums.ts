/**
 * Domain vocabulary shared by the browser and the server.
 * Arrays are `as const` so that types, zod enums and UI option lists come from one place.
 */

export const EVENT_TYPES = ['wedding', 'birthday', 'community'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const TIERS = ['simple', 'standard', 'premium'] as const;
export type Tier = (typeof TIERS)[number];

export const CATEGORIES = [
  'venue',
  'catering',
  'decor',
  'photo',
  'entertainment',
  'attire',
  'gifts',
  'logistics',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = [1, 2, 3, 4, 5] as const;
export type Priority = (typeof PRIORITIES)[number];

export const AGE_GROUPS = ['kids', 'teens', 'adults', 'seniors'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const DIETS = ['veg', 'jain', 'nonveg', 'vegan'] as const;
export type Diet = (typeof DIETS)[number];

export const ACCESS_NEEDS = ['wheelchair', 'hearing', 'vision', 'sensory'] as const;
export type AccessNeed = (typeof ACCESS_NEEDS)[number];

export const QUOTE_STATUSES = ['received', 'shortlisted', 'accepted'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const COST_LEVELS = ['lower', 'similar', 'higher'] as const;
export type CostLevel = (typeof COST_LEVELS)[number];

export const AI_SOURCES = ['gemini', 'openrouter', 'nvidia', 'rules'] as const;
export type AiSource = (typeof AI_SOURCES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: 'Wedding',
  birthday: 'Birthday',
  community: 'Community event',
};

export const TIER_LABELS: Record<Tier, string> = {
  simple: 'Simple',
  standard: 'Standard',
  premium: 'Premium',
};

export const TIER_DESCRIPTIONS: Record<Tier, string> = {
  simple: 'Keep it warm and modest. Spend only where it counts.',
  standard: 'A comfortable, well-run celebration.',
  premium: 'Go grand where it matters to you.',
};

export const CATEGORY_LABELS: Record<Category, string> = {
  venue: 'Venue',
  catering: 'Food & catering',
  decor: 'Decoration',
  photo: 'Photo & video',
  entertainment: 'Music & entertainment',
  attire: 'Outfits & styling',
  gifts: 'Invites & return gifts',
  logistics: 'Logistics, sound & permits',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  1: 'Not important',
  2: 'Low',
  3: 'Medium',
  4: 'High',
  5: 'Must be great',
};

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  kids: 'Young children',
  teens: 'Teenagers',
  adults: 'Adults',
  seniors: 'Elderly family members',
};

export const DIET_LABELS: Record<Diet, string> = {
  veg: 'Vegetarian',
  jain: 'Jain',
  nonveg: 'Non-vegetarian',
  vegan: 'Vegan',
};

export const ACCESS_NEED_LABELS: Record<AccessNeed, string> = {
  wheelchair: 'Wheelchair access',
  hearing: 'Hearing support',
  vision: 'Low-vision support',
  sensory: 'Quiet / low-sensory space',
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  received: 'Received',
  shortlisted: 'Shortlisted',
  accepted: 'Accepted',
};
