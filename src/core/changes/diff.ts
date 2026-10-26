/**
 * Plan diff: what a change does BEFORE the host applies it.
 * It covers budget deltas, tasks that become overdue or are compressed, quotes that need revising,
 * and what is kept. This is how a single change is shown rippling through the whole plan.
 */
import { CATEGORY_LABELS, TIER_LABELS, type Category } from '../constants/enums.js';
import { estimateBudget, type BudgetStatus } from '../budget.js';
import { diffDays, formatDate } from '../dates.js';
import { formatInr, formatNumber } from '../money.js';
import { buildSchedule } from '../timeline.js';
import type { PlanState } from '../schemas.js';

export interface FieldChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface LineDelta {
  category: Category;
  label: string;
  before: number;
  after: number;
  delta: number;
}

export interface BudgetSide {
  total: number;
  budget: number;
  gap: number;
  status: BudgetStatus;
}

export interface TaskRef {
  id: string;
  title: string;
  due: string;
}

export interface RequoteNotice {
  quoteId: string;
  vendorLabel: string;
  category: Category;
  reason: string;
}

export interface PlanDiff {
  fieldChanges: FieldChange[];
  budget: { before: BudgetSide; after: BudgetSide; lines: LineDelta[] };
  schedule: {
    daysLeftBefore: number;
    daysLeftAfter: number;
    newlyOverdue: TaskRef[];
    becameCompressed: boolean;
    movedTasks: number;
  };
  requotes: RequoteNotice[];
  kept: { doneTasks: number; quotes: number; hasIdeas: boolean };
  /** True when nothing material changes. */
  isEmpty: boolean;
}

function fieldChanges(before: PlanState, after: PlanState): FieldChange[] {
  const a = before.profile;
  const b = after.profile;
  const changes: FieldChange[] = [];
  if (a.guests !== b.guests) {
    changes.push({
      field: 'guests',
      label: 'Guests',
      from: formatNumber(a.guests),
      to: formatNumber(b.guests),
    });
  }
  if (a.budget !== b.budget) {
    changes.push({
      field: 'budget',
      label: 'Budget',
      from: formatInr(a.budget),
      to: formatInr(b.budget),
    });
  }
  if (a.eventDate !== b.eventDate) {
    changes.push({
      field: 'eventDate',
      label: 'Event date',
      from: formatDate(a.eventDate),
      to: formatDate(b.eventDate),
    });
  }
  if (a.tier !== b.tier) {
    changes.push({
      field: 'tier',
      label: 'Overall style',
      from: TIER_LABELS[a.tier],
      to: TIER_LABELS[b.tier],
    });
  }
  if (a.contingencyPct !== b.contingencyPct) {
    changes.push({
      field: 'contingencyPct',
      label: 'Surprise buffer',
      from: `${a.contingencyPct}%`,
      to: `${b.contingencyPct}%`,
    });
  }
  return changes;
}

function side(plan: PlanState): BudgetSide & { lines: Map<Category, number> } {
  const summary = estimateBudget(plan.profile, plan.quotes);
  return {
    total: summary.total,
    budget: summary.budget,
    gap: summary.gap,
    status: summary.status,
    lines: new Map(summary.lines.map((line) => [line.category, line.amount])),
  };
}

function lineDeltas(before: Map<Category, number>, after: Map<Category, number>): LineDelta[] {
  const categories = new Set([...before.keys(), ...after.keys()]);
  const deltas: LineDelta[] = [];
  for (const category of categories) {
    const from = before.get(category) ?? 0;
    const to = after.get(category) ?? 0;
    if (from !== to) {
      deltas.push({
        category,
        label: CATEGORY_LABELS[category],
        before: from,
        after: to,
        delta: to - from,
      });
    }
  }
  return deltas.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
}

function requotes(before: PlanState, after: PlanState): RequoteNotice[] {
  const guestsGrew = after.profile.guests > before.profile.guests;
  const dateMoved = after.profile.eventDate !== before.profile.eventDate;
  const notices: RequoteNotice[] = [];
  for (const quote of after.quotes) {
    if (guestsGrew && quote.guestsCovered !== null && quote.guestsCovered < after.profile.guests) {
      notices.push({
        quoteId: quote.id,
        vendorLabel: quote.vendorLabel,
        category: quote.category,
        reason: `Quoted for ${formatNumber(quote.guestsCovered)} guests. Ask for a revised quote for ${formatNumber(after.profile.guests)}.`,
      });
    } else if (dateMoved) {
      notices.push({
        quoteId: quote.id,
        vendorLabel: quote.vendorLabel,
        category: quote.category,
        reason: `Confirm they are free on ${formatDate(after.profile.eventDate)} and that the price still holds.`,
      });
    }
  }
  return notices;
}

export function diffPlans(before: PlanState, after: PlanState, today: string): PlanDiff {
  const budgetBefore = side(before);
  const budgetAfter = side(after);
  const scheduleOf = (plan: PlanState) =>
    buildSchedule({
      eventType: plan.profile.eventType,
      eventDate: plan.profile.eventDate,
      startDate: plan.startDate,
      progress: plan.progress,
      today,
    });
  const schedBefore = scheduleOf(before);
  const schedAfter = scheduleOf(after);
  const overdueBefore = new Set(
    schedBefore.tasks.filter((t) => t.state === 'overdue').map((t) => t.id),
  );
  const dueBefore = new Map(schedBefore.tasks.map((t) => [t.id, t.due]));

  const fields = fieldChanges(before, after);
  const lines = lineDeltas(budgetBefore.lines, budgetAfter.lines);
  const strip = ({ lines: _lines, ...rest }: ReturnType<typeof side>): BudgetSide => rest;
  const diff: PlanDiff = {
    fieldChanges: fields,
    budget: { before: strip(budgetBefore), after: strip(budgetAfter), lines },
    schedule: {
      daysLeftBefore: schedBefore.daysLeft,
      daysLeftAfter: schedAfter.daysLeft,
      newlyOverdue: schedAfter.tasks
        .filter((t) => t.state === 'overdue' && !overdueBefore.has(t.id))
        .map((t) => ({ id: t.id, title: t.title, due: t.due })),
      becameCompressed: schedAfter.compressed && !schedBefore.compressed,
      movedTasks: schedAfter.tasks.filter((t) => {
        const previous = dueBefore.get(t.id);
        return previous !== undefined && diffDays(t.due, previous) !== 0;
      }).length,
    },
    requotes: requotes(before, after),
    kept: {
      doneTasks: schedAfter.counts.done,
      quotes: after.quotes.length,
      hasIdeas: after.ideas !== null,
    },
    isEmpty: false,
  };
  diff.isEmpty =
    fields.length === 0 && lines.length === 0 && budgetBefore.total === budgetAfter.total;
  return diff;
}
