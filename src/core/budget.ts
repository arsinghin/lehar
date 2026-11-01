/**
 * Budget engine: turns a profile (+ any accepted quotes) into estimated cost lines.
 * Pure and deterministic. The AI never produces or alters these numbers.
 */
import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  type Priority,
  type Tier,
} from './constants/enums.js';
import {
  BASE_RATES,
  ESTIMATE_ROUNDING_STEP,
  GUEST_SCALED,
  MIN_BUDGET_PER_GUEST,
  MIN_PLATE_COST,
  MIN_SAFE_CONTINGENCY_PCT,
  QUOTE_OVER_ESTIMATE_RATIO,
  RATE_BASIS,
  TIER_MULTIPLIER,
  TIGHT_BUDGET_RATIO,
  type Rate,
} from './constants/rates.js';
import { formatInr, roundTo } from './money.js';
import { effectiveTier } from './profile.js';
import type { EventProfile, Quote } from './schemas.js';

export type BudgetBasis = 'estimate' | 'quote';
export type BudgetStatus = 'within' | 'tight' | 'over';

export interface BudgetLine {
  category: Category;
  label: string;
  tier: Tier;
  basis: BudgetBasis;
  amount: number;
  /** Estimated amount from assumptions, even when a quote replaces it. */
  estimate: number;
  rate: Rate;
  rateIsCustom: boolean;
  guestScaled: boolean;
  priority: Priority;
  isProtected: boolean;
  /** Plain-language basis of the number, shown beside it. */
  assumption: string;
  quoteLabel: string | null;
}

export type BudgetWarningCode =
  | 'catering-below-floor'
  | 'budget-per-guest-low'
  | 'quote-over-estimate'
  | 'quote-short-of-guests'
  | 'no-contingency';

export interface BudgetWarning {
  code: BudgetWarningCode;
  category?: Category;
  message: string;
}

export interface BudgetSummary {
  lines: BudgetLine[];
  subtotal: number;
  contingencyPct: number;
  contingency: number;
  total: number;
  budget: number;
  /** total − budget: positive means over budget. */
  gap: number;
  /** gap as a share of the budget, e.g. 0.2 for 20 % over. Negative when under. */
  gapRatio: number;
  status: BudgetStatus;
  perGuest: number;
  warnings: BudgetWarning[];
}

/** The rate in force for a category: a custom override, otherwise base × tier. Null when not applicable. */
export function categoryRate(profile: EventProfile, category: Category): Rate | null {
  const override = profile.rateOverrides[category];
  if (override) return override;
  const base = BASE_RATES[profile.eventType][category];
  if (!base) return null;
  const multiplier = TIER_MULTIPLIER[effectiveTier(profile, category)];
  return { perGuest: base.perGuest * multiplier, fixed: base.fixed * multiplier };
}

/** Cost of a rate for a guest count, rounded so estimates never look falsely precise. */
export function costForRate(rate: Rate, guests: number): number {
  return roundTo(rate.perGuest * guests + rate.fixed, ESTIMATE_ROUNDING_STEP);
}

/** The surprise buffer on a subtotal, rounded like every estimate. */
export function contingencyFor(subtotal: number, pct: number): number {
  return roundTo((subtotal * pct) / 100, ESTIMATE_ROUNDING_STEP);
}

/** Categories that will appear in this plan. */
export function activeCategories(profile: EventProfile): Category[] {
  return CATEGORIES.filter(
    (category) =>
      !profile.excludedCategories.includes(category) && categoryRate(profile, category) !== null,
  );
}

/** The accepted quote for a category, if the host has accepted one. */
export function acceptedQuoteFor(quotes: readonly Quote[], category: Category): Quote | undefined {
  return quotes.find((quote) => quote.category === category && quote.status === 'accepted');
}

function buildLine(
  profile: EventProfile,
  category: Category,
  rate: Rate,
  quote: Quote | undefined,
): BudgetLine {
  const estimate = costForRate(rate, profile.guests);
  const isCustom = profile.rateOverrides[category] !== undefined;
  return {
    category,
    label: CATEGORY_LABELS[category],
    tier: effectiveTier(profile, category),
    basis: quote ? 'quote' : 'estimate',
    amount: quote ? quote.amount : estimate,
    estimate,
    rate,
    rateIsCustom: isCustom,
    guestScaled: GUEST_SCALED.has(category),
    priority: profile.priorities[category],
    isProtected: profile.protectedCategories.includes(category),
    assumption: isCustom ? 'Your own rate' : RATE_BASIS[category],
    quoteLabel: quote ? quote.vendorLabel : null,
  };
}

function statusFor(total: number, budget: number): BudgetStatus {
  if (total > budget) return 'over';
  if (total > budget * TIGHT_BUDGET_RATIO) return 'tight';
  return 'within';
}

type WarningRule = (
  profile: EventProfile,
  lines: readonly BudgetLine[],
  quotes: readonly Quote[],
) => BudgetWarning[];

const cateringBelowFloor: WarningRule = (profile, lines) => {
  const catering = lines.find((line) => line.category === 'catering');
  const plateFloor = MIN_PLATE_COST[profile.eventType];
  if (!catering || profile.guests <= 0 || catering.amount / profile.guests >= plateFloor) return [];
  return [
    {
      code: 'catering-below-floor',
      category: 'catering',
      message: `Food works out to ${formatInr(catering.amount / profile.guests)} per guest, below about ${formatInr(plateFloor)} that a full meal usually needs. Consider a simpler menu style rather than a smaller plate.`,
    },
  ];
};

const budgetPerGuestLow: WarningRule = (profile) => {
  const perGuestBudget = profile.budget / profile.guests;
  const perGuestFloor = MIN_BUDGET_PER_GUEST[profile.eventType];
  if (perGuestBudget >= perGuestFloor) return [];
  return [
    {
      code: 'budget-per-guest-low',
      message: `The budget is ${formatInr(perGuestBudget)} per guest. Plans of this kind usually need at least ${formatInr(perGuestFloor)}, so expect real trade-offs.`,
    },
  ];
};

const quoteWarnings: WarningRule = (profile, lines, quotes) =>
  lines.flatMap((line): BudgetWarning[] => {
    const warnings: BudgetWarning[] = [];
    if (line.basis === 'quote' && line.amount > line.estimate * QUOTE_OVER_ESTIMATE_RATIO) {
      warnings.push({
        code: 'quote-over-estimate',
        category: line.category,
        message: `The accepted ${line.label.toLowerCase()} quote is ${formatInr(line.amount - line.estimate)} above the estimate.`,
      });
    }
    const quote = acceptedQuoteFor(quotes, line.category);
    if (quote && quote.guestsCovered !== null && quote.guestsCovered < profile.guests) {
      warnings.push({
        code: 'quote-short-of-guests',
        category: line.category,
        message: `${quote.vendorLabel} quoted for ${String(quote.guestsCovered)} guests, but you now expect ${String(profile.guests)}. Ask for a revised quote.`,
      });
    }
    return warnings;
  });

const noContingency: WarningRule = (profile) =>
  profile.contingencyPct === 0
    ? [
        {
          code: 'no-contingency',
          message: `There is no buffer for surprises. Even ${String(MIN_SAFE_CONTINGENCY_PCT)} % can save the day.`,
        },
      ]
    : [];

/** Checks run on every estimate, in the order their warnings are shown. */
const WARNING_RULES: readonly WarningRule[] = [
  cateringBelowFloor,
  budgetPerGuestLow,
  quoteWarnings,
  noContingency,
];

function collectWarnings(
  profile: EventProfile,
  lines: readonly BudgetLine[],
  quotes: readonly Quote[],
): BudgetWarning[] {
  return WARNING_RULES.flatMap((rule) => rule(profile, lines, quotes));
}

/** Full budget picture for a profile. Lines always sum exactly to the subtotal. */
export function estimateBudget(
  profile: EventProfile,
  quotes: readonly Quote[] = [],
): BudgetSummary {
  const lines: BudgetLine[] = [];
  for (const category of activeCategories(profile)) {
    const rate = categoryRate(profile, category);
    if (rate) lines.push(buildLine(profile, category, rate, acceptedQuoteFor(quotes, category)));
  }
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const contingency = contingencyFor(subtotal, profile.contingencyPct);
  const total = subtotal + contingency;
  const gap = total - profile.budget;
  return {
    lines,
    subtotal,
    contingencyPct: profile.contingencyPct,
    contingency,
    total,
    budget: profile.budget,
    gap,
    gapRatio: gap / profile.budget,
    status: statusFor(total, profile.budget),
    perGuest: Math.round(total / profile.guests),
    warnings: collectWarnings(profile, lines, quotes),
  };
}

/** Budget increases are suggested in round thousands. */
const BUDGET_ROUNDING_STEP = 1000;

/** The smallest round budget that covers `total`. */
export function budgetToCover(total: number): number {
  return Math.ceil(total / BUDGET_ROUNDING_STEP) * BUDGET_ROUNDING_STEP;
}
