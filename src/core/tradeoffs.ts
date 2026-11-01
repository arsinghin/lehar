/**
 * Trade-off engine for when the plan costs more than the budget.
 *
 * It never cuts blindly. It lists concrete levers, says what each saves and which priority it
 * touches, and ranks them by "rupees saved per unit of pain". Protected categories and a locked guest
 * count are never touched. The host chooses; nothing here is applied automatically.
 */
import {
  CATEGORY_LABELS,
  TIER_LABELS,
  TIERS,
  type Category,
  type Priority,
} from './constants/enums.js';
import { MIN_SAFE_CONTINGENCY_PCT, OPTIONAL_CATEGORIES } from './constants/rates.js';
import {
  acceptedQuoteFor,
  categoryRate,
  costForRate,
  estimateBudget,
  type BudgetSummary,
} from './budget.js';
import { formatInr } from './money.js';
import { applyProfilePatch, effectiveTier, type ProfilePatch } from './profile.js';
import type { EventProfile, Quote } from './schemas.js';

export type LeverKind = 'tier-down' | 'skip-category' | 'trim-guests' | 'reduce-buffer';

export interface Lever {
  id: string;
  kind: LeverKind;
  category?: Category;
  title: string;
  detail: string;
  /** Estimated saving on the total, including the buffer that scales with it. */
  saving: number;
  /** 1–5: how much this hurts, based on the host's own priorities. */
  pain: number;
  patch: ProfilePatch;
}

export interface TradeoffAnalysis {
  gap: number;
  levers: Lever[];
  /** Cheapest-pain combination that closes the gap (ids), if one exists. */
  suggestedIds: string[];
  suggestionClosesGap: boolean;
}

/** Trimming the guest list is usually the hardest family conversation, so it is weighted as high pain. */
export const GUEST_TRIM_PAIN = 4;
/** Cutting the buffer is cheap today but risky later. */
export const BUFFER_PAIN = 2.5;
/** Never suggest trimming more than a quarter of the list in one step. */
export const MAX_GUEST_TRIM_RATIO = 0.25;
/** Only categories the host rated "Low" or "Not important" are offered as skippable. */
export const SKIPPABLE_MAX_PRIORITY: Priority = 2;
/** Dropping a category hurts a little more than down-grading one the host rated the same. */
export const SKIP_EXTRA_PAIN = 0.5;

const withBuffer = (amount: number, pct: number) => amount * (1 + pct / 100);

function tierDownLevers(profile: EventProfile, summary: BudgetSummary): Lever[] {
  const levers: Lever[] = [];
  for (const line of summary.lines) {
    const category = line.category;
    if (line.isProtected || line.basis === 'quote' || line.rateIsCustom) continue;
    const tier = effectiveTier(profile, category);
    const lower = TIERS[TIERS.indexOf(tier) - 1];
    if (!lower) continue;
    const patch: ProfilePatch = { categoryTiers: { [category]: lower } };
    const lowerRate = categoryRate(applyProfilePatch(profile, patch), category);
    if (!lowerRate) continue;
    const saving = withBuffer(
      line.amount - costForRate(lowerRate, profile.guests),
      profile.contingencyPct,
    );
    if (saving <= 0) continue;
    levers.push({
      id: `tier-down:${category}`,
      kind: 'tier-down',
      category,
      title: `${CATEGORY_LABELS[category]}: ${TIER_LABELS[tier]} → ${TIER_LABELS[lower]}`,
      detail: `Keeps ${CATEGORY_LABELS[category].toLowerCase()} in the plan, with a simpler package.`,
      saving: Math.round(saving),
      pain: line.priority,
      patch,
    });
  }
  return levers;
}

function skipLevers(
  profile: EventProfile,
  quotes: readonly Quote[],
  summary: BudgetSummary,
): Lever[] {
  const levers: Lever[] = [];
  for (const line of summary.lines) {
    const lowPriority = line.priority <= SKIPPABLE_MAX_PRIORITY;
    if (!OPTIONAL_CATEGORIES.has(line.category) || line.isProtected || !lowPriority) continue;
    if (acceptedQuoteFor(quotes, line.category)) continue;
    levers.push({
      id: `skip:${line.category}`,
      kind: 'skip-category',
      category: line.category,
      title: `Skip ${CATEGORY_LABELS[line.category].toLowerCase()}`,
      detail: 'You marked this as low priority. Friends or family could cover it informally.',
      saving: Math.round(withBuffer(line.amount, profile.contingencyPct)),
      pain: line.priority + SKIP_EXTRA_PAIN,
      patch: { excludedCategories: [...profile.excludedCategories, line.category] },
    });
  }
  return levers;
}

function trimGuestsLever(profile: EventProfile, summary: BudgetSummary): Lever | null {
  if (profile.lockGuestCount || profile.guests < 2) return null;
  const perGuest = summary.lines
    .filter((line) => line.basis === 'estimate')
    .reduce((sum, line) => sum + line.rate.perGuest, 0);
  const perGuestWithBuffer = withBuffer(perGuest, profile.contingencyPct);
  if (perGuestWithBuffer <= 0) return null;
  const maxTrim = Math.floor(profile.guests * MAX_GUEST_TRIM_RATIO);
  const trim = Math.min(Math.ceil(summary.gap / perGuestWithBuffer), maxTrim);
  if (trim < 1) return null;
  const guests = profile.guests - trim;
  return {
    id: 'trim-guests',
    kind: 'trim-guests',
    title: `Invite ${trim} fewer guests (${profile.guests} → ${guests})`,
    detail: `Each guest costs about ${formatInr(perGuestWithBuffer)} across food, seating and gifts.`,
    saving: Math.round(trim * perGuestWithBuffer),
    pain: GUEST_TRIM_PAIN,
    patch: { guests },
  };
}

function bufferLever(profile: EventProfile, summary: BudgetSummary): Lever | null {
  if (profile.contingencyPct <= MIN_SAFE_CONTINGENCY_PCT) return null;
  const saving =
    summary.contingency - Math.round((summary.subtotal * MIN_SAFE_CONTINGENCY_PCT) / 100);
  if (saving <= 0) return null;
  return {
    id: 'reduce-buffer',
    kind: 'reduce-buffer',
    title: `Shrink the surprise buffer: ${profile.contingencyPct}% → ${MIN_SAFE_CONTINGENCY_PCT}%`,
    detail: 'Frees money now, but leaves less room for last-minute costs.',
    saving,
    pain: BUFFER_PAIN,
    patch: { contingencyPct: MIN_SAFE_CONTINGENCY_PCT },
  };
}

/** Levers that touch a category the host rated, so their pain is the host's own priority. */
export function isRatedLever(lever: Lever): boolean {
  return lever.kind === 'tier-down' || lever.kind === 'skip-category';
}

/** Merges several lever patches into one (category maps and exclusions are combined). */
export function combineLeverPatches(profile: EventProfile, levers: readonly Lever[]): ProfilePatch {
  const combined: ProfilePatch = {};
  const excluded = new Set(profile.excludedCategories);
  for (const lever of levers) {
    const { categoryTiers, excludedCategories, ...rest } = lever.patch;
    Object.assign(combined, rest);
    if (categoryTiers) combined.categoryTiers = { ...combined.categoryTiers, ...categoryTiers };
    for (const category of excludedCategories ?? []) excluded.add(category);
  }
  if (excluded.size !== profile.excludedCategories.length)
    combined.excludedCategories = [...excluded];
  return combined;
}

/** Applies levers and returns the recomputed budget, which is exact rather than the sum of the estimates. */
export function previewLevers(
  profile: EventProfile,
  quotes: readonly Quote[],
  levers: readonly Lever[],
): BudgetSummary {
  return estimateBudget(applyProfilePatch(profile, combineLeverPatches(profile, levers)), quotes);
}

/**
 * All levers ranked best-first, plus a suggested combination. Empty when within budget.
 * Pass `summary` when the caller already has the budget, to avoid computing it twice.
 */
export function analyzeTradeoffs(
  profile: EventProfile,
  quotes: readonly Quote[] = [],
  summary: BudgetSummary = estimateBudget(profile, quotes),
): TradeoffAnalysis {
  if (summary.gap <= 0)
    return { gap: summary.gap, levers: [], suggestedIds: [], suggestionClosesGap: true };

  const candidates: (Lever | null)[] = [
    ...tierDownLevers(profile, summary),
    ...skipLevers(profile, quotes, summary),
    trimGuestsLever(profile, summary),
    bufferLever(profile, summary),
  ];
  const levers = candidates
    .filter((lever): lever is Lever => lever !== null)
    .sort((a, b) => b.saving / b.pain - a.saving / a.pain || a.id.localeCompare(b.id));

  // Greedy: add the best-value levers until the exact recomputed total fits. Skipping a category
  // and down-grading the same category are mutually exclusive.
  const chosen: Lever[] = [];
  const touched = new Set<Category>();
  let closes = false;
  for (const lever of levers) {
    if (lever.category && touched.has(lever.category)) continue;
    chosen.push(lever);
    if (lever.category) touched.add(lever.category);
    if (previewLevers(profile, quotes, chosen).gap <= 0) {
      closes = true;
      break;
    }
  }
  return {
    gap: summary.gap,
    levers,
    suggestedIds: chosen.map((lever) => lever.id),
    suggestionClosesGap: closes,
  };
}
