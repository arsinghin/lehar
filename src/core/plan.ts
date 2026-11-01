/** Plan lifecycle helpers and the derived view model used by the UI. */
import { estimateBudget, type BudgetSummary } from './budget.js';
import type { IsoDate } from './dates.js';
import { formatInr } from './money.js';
import { applyProfilePatch, type ProfilePatch } from './profile.js';
import { analyzeTradeoffs, type TradeoffAnalysis } from './tradeoffs.js';
import { scheduleFor, type Schedule } from './timeline.js';
import { vendorBrief, type VendorBrief } from './vendors.js';
import type { EventProfile, PlanState } from './schemas.js';

export interface DerivedPlan {
  budget: BudgetSummary;
  schedule: Schedule;
  tradeoffs: TradeoffAnalysis;
  vendorBriefs: VendorBrief[];
}

export interface NewPlanOptions {
  id: string;
  now: string;
  today: IsoDate;
  isDemo?: boolean;
}

/** A fresh plan for a profile: nothing done, no quotes or ideas yet. */
export function createPlanState(profile: EventProfile, options: NewPlanOptions): PlanState {
  return {
    schemaVersion: 1,
    id: options.id,
    createdAt: options.now,
    startDate: options.today,
    isDemo: options.isDemo ?? false,
    profile,
    progress: {},
    quotes: [],
    ideas: null,
    vendorQuestions: {},
  };
}

/** The plan with its profile edited; progress, quotes and ideas are kept. */
export function withProfilePatch(plan: PlanState, patch: ProfilePatch): PlanState {
  return { ...plan, profile: applyProfilePatch(plan.profile, patch) };
}

/** The edit for a what-if on guests and budget, with a summary; null when nothing would change. */
export function whatIfPatch(
  profile: EventProfile,
  guests: number,
  budget: number,
): { patch: ProfilePatch; summary: string } | null {
  const patch: ProfilePatch = {};
  const parts: string[] = [];
  if (guests !== profile.guests) {
    patch.guests = guests;
    parts.push(`guests ${String(profile.guests)} → ${String(guests)}`);
  }
  if (budget !== profile.budget) {
    patch.budget = budget;
    parts.push(`budget ${formatInr(profile.budget)} → ${formatInr(budget)}`);
  }
  return parts.length > 0 ? { patch, summary: parts.join(', ') } : null;
}

/** Everything the screens show for a plan, computed once per change. */
export function derivePlan(plan: PlanState, today: IsoDate): DerivedPlan {
  const budget = estimateBudget(plan.profile, plan.quotes);
  const vendorBriefs = budget.lines
    .map((line) => vendorBrief(plan.profile, line))
    .filter((brief): brief is VendorBrief => brief !== null);
  return {
    budget,
    schedule: scheduleFor(plan, today),
    tradeoffs: analyzeTradeoffs(plan.profile, plan.quotes, budget),
    vendorBriefs,
  };
}
