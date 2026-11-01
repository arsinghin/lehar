/** Plain-language "ripple" messages for budget edits, shown and announced after every change. */
import { estimateBudget, type BudgetSummary } from '../../core/budget';
import { formatInr, formatSignedInr } from '../../core/money';
import { applyProfilePatch, type ProfilePatch } from '../../core/profile';
import type { PlanState } from '../../core/schemas';
import type { NoticeMessage } from '../../components/Notice';

/** "over budget by ₹…" or "₹… left". */
export function standing(summary: BudgetSummary): string {
  if (summary.gap > 0) return `over budget by ${formatInr(summary.gap)}`;
  return `${formatInr(-summary.gap)} left`;
}

/** Applies the patch virtually and describes its effect on the total. */
export function rippleMessage(plan: PlanState, patch: ProfilePatch, what: string): NoticeMessage {
  const before = estimateBudget(plan.profile, plan.quotes);
  const after = estimateBudget(applyProfilePatch(plan.profile, patch), plan.quotes);
  return rippleFromSummaries(before, after, what);
}

/** The ripple message for a change between two budget summaries. */
export function rippleFromSummaries(
  before: BudgetSummary,
  after: BudgetSummary,
  what: string,
): NoticeMessage {
  const delta = after.total - before.total;
  const tone = after.status === 'over' ? 'warn' : 'ok';
  const change = delta === 0 ? 'no change to the total' : `${formatSignedInr(delta)} on the total`;
  return { tone, text: `${what}: ${change}. Now ${formatInr(after.total)} (${standing(after)}).` };
}
