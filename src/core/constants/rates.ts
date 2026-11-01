/**
 * Planning assumptions used to ESTIMATE costs before the host has real quotes.
 *
 * These are deliberately round, mid-range figures for an Indian metro or tier-2 city in 2026, at the
 * "standard" tier. They are not vendor prices. The UI always labels them "Estimate (assumption)",
 * shows the rate behind every line, and lets the host overwrite any rate. Once a quote is
 * accepted, the quote replaces the estimate.
 */
import type { Category, EventType, Tier } from './enums.js';

export interface Rate {
  /** Rupees per guest (e.g. per plate, per seat, per return gift). */
  perGuest: number;
  /** Rupees that do not scale with headcount (e.g. a photographer's day rate). */
  fixed: number;
}

/** Simple ≈ 60 %, premium ≈ 170 % of a standard spend. */
export const TIER_MULTIPLIER: Record<Tier, number> = {
  simple: 0.6,
  standard: 1,
  premium: 1.7,
};

/** A 10 % buffer for the surprises every Indian celebration has. */
export const DEFAULT_CONTINGENCY_PCT = 10;
/** Below this, trade-offs never suggest cutting the buffer further. */
export const MIN_SAFE_CONTINGENCY_PCT = 5;

/** Estimates are rounded so they never look more precise than they are. */
export const ESTIMATE_ROUNDING_STEP = 100;

/** Categories whose cost is driven mostly by headcount. */
export const GUEST_SCALED: ReadonlySet<Category> = new Set([
  'catering',
  'gifts',
  'venue',
  'logistics',
]);

/** Categories a host can reasonably skip outright when money is tight. */
export const OPTIONAL_CATEGORIES: ReadonlySet<Category> = new Set([
  'entertainment',
  'gifts',
  'photo',
]);

export const BASE_RATES: Record<EventType, Partial<Record<Category, Rate>>> = {
  wedding: {
    venue: { perGuest: 300, fixed: 60_000 },
    catering: { perGuest: 1_100, fixed: 0 },
    decor: { perGuest: 0, fixed: 90_000 },
    photo: { perGuest: 0, fixed: 75_000 },
    entertainment: { perGuest: 0, fixed: 45_000 },
    attire: { perGuest: 0, fixed: 1_00_000 },
    gifts: { perGuest: 150, fixed: 0 },
    logistics: { perGuest: 100, fixed: 25_000 },
  },
  birthday: {
    venue: { perGuest: 200, fixed: 5_000 },
    catering: { perGuest: 500, fixed: 0 },
    decor: { perGuest: 0, fixed: 8_000 },
    photo: { perGuest: 0, fixed: 6_000 },
    entertainment: { perGuest: 0, fixed: 7_000 },
    gifts: { perGuest: 100, fixed: 0 },
    logistics: { perGuest: 0, fixed: 2_000 },
  },
  community: {
    venue: { perGuest: 20, fixed: 10_000 },
    catering: { perGuest: 250, fixed: 0 },
    decor: { perGuest: 0, fixed: 25_000 },
    photo: { perGuest: 0, fixed: 8_000 },
    entertainment: { perGuest: 0, fixed: 30_000 },
    gifts: { perGuest: 30, fixed: 0 },
    logistics: { perGuest: 30, fixed: 15_000 },
  },
};

/** What each rate means, shown next to every estimate. */
export const RATE_BASIS: Record<Category, string> = {
  venue: 'Hall or ground hire plus seating per guest',
  catering: 'Per plate, standard menu with service',
  decor: 'Stage, entrance and table decor package',
  photo: 'Photographer (and video for weddings) for the main day',
  entertainment: 'DJ, band, performer or activity host',
  attire: 'Main outfits and styling for the hosts',
  gifts: 'Invitations and return gifts per guest',
  logistics: 'Sound, transport, permits and safety',
};

/** Per-plate amounts below these are unrealistic for a sit-down meal, so they trigger a warning. */
export const MIN_PLATE_COST: Record<EventType, number> = {
  wedding: 450,
  birthday: 200,
  community: 80,
};

/** Overall rupees-per-guest below which the plan is unlikely to work at all. */
export const MIN_BUDGET_PER_GUEST: Record<EventType, number> = {
  wedding: 1_200,
  birthday: 500,
  community: 150,
};

/** An accepted quote this far above its estimate gets flagged. */
export const QUOTE_OVER_ESTIMATE_RATIO = 1.15;

/** Within 5 % of the budget is "tight", above it is "over". */
export const TIGHT_BUDGET_RATIO = 0.95;
