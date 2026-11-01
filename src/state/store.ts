/**
 * App store: the current plan plus undo/redo history. Every meaningful edit is a commit, so any
 * change, trade-off or what-if can be undone or restored later. Pure reducer.
 *
 * Two actions deliberately skip history: `ideas/set` and `vendorQuestions/set` store AI suggestions,
 * which are cheap to fetch again and would otherwise crowd real edits out of the history.
 */
import { LIMITS } from '../core/constants/limits';
import type { Category, QuoteStatus } from '../core/constants/enums';
import { nowIso } from '../core/dates';
import { withProfilePatch } from '../core/plan';
import { clampDelay } from '../core/timeline';
import type { ProfilePatch } from '../core/profile';
import type { IdeaSet, PlanState, Quote, Snapshot, VendorQuestionSet } from '../core/schemas';

export interface StoreState {
  plan: PlanState | null;
  past: Snapshot[];
  future: Snapshot[];
}

export type StoreAction =
  | { type: 'plan/open'; plan: PlanState; reason: string; at: string }
  | { type: 'plan/patch'; patch: ProfilePatch; reason: string; at: string }
  | { type: 'plan/resetRate'; category: Category; reason: string; at: string }
  | { type: 'task/setDone'; taskId: string; title: string; done: boolean; at: string }
  | { type: 'task/delay'; taskId: string; title: string; days: number; at: string }
  | { type: 'quote/add'; quote: Quote; at: string }
  | { type: 'quote/setStatus'; id: string; status: QuoteStatus; at: string }
  | { type: 'quote/remove'; id: string; at: string }
  | { type: 'ideas/set'; ideas: IdeaSet }
  | { type: 'vendorQuestions/set'; category: Category; value: VendorQuestionSet }
  | { type: 'history/undo' }
  | { type: 'history/redo' }
  | { type: 'history/restore'; index: number; at: string };

/** Action creators. They stamp the time, so components never build timestamps themselves. */
export const actions = {
  openPlan: (plan: PlanState, reason: string): StoreAction => ({
    type: 'plan/open',
    plan,
    reason,
    at: nowIso(),
  }),
  patchPlan: (patch: ProfilePatch, reason: string): StoreAction => ({
    type: 'plan/patch',
    patch,
    reason,
    at: nowIso(),
  }),
  resetRate: (category: Category, reason: string): StoreAction => ({
    type: 'plan/resetRate',
    category,
    reason,
    at: nowIso(),
  }),
  setTaskDone: (taskId: string, title: string, done: boolean): StoreAction => ({
    type: 'task/setDone',
    taskId,
    title,
    done,
    at: nowIso(),
  }),
  delayTask: (taskId: string, title: string, days: number): StoreAction => ({
    type: 'task/delay',
    taskId,
    title,
    days,
    at: nowIso(),
  }),
  addQuote: (quote: Quote): StoreAction => ({ type: 'quote/add', quote, at: nowIso() }),
  setQuoteStatus: (id: string, status: QuoteStatus): StoreAction => ({
    type: 'quote/setStatus',
    id,
    status,
    at: nowIso(),
  }),
  removeQuote: (id: string): StoreAction => ({ type: 'quote/remove', id, at: nowIso() }),
  setIdeas: (ideas: IdeaSet): StoreAction => ({ type: 'ideas/set', ideas }),
  setVendorQuestions: (category: Category, value: VendorQuestionSet): StoreAction => ({
    type: 'vendorQuestions/set',
    category,
    value,
  }),
  undo: (): StoreAction => ({ type: 'history/undo' }),
  redo: (): StoreAction => ({ type: 'history/redo' }),
  restore: (index: number): StoreAction => ({ type: 'history/restore', index, at: nowIso() }),
} as const;

export const EMPTY_STORE: StoreState = { plan: null, past: [], future: [] };

/** Replaces the plan and records the previous one in history (nothing to record for the first plan). */
function commit(state: StoreState, plan: PlanState, reason: string, at: string): StoreState {
  if (!state.plan) return { plan, past: [], future: [] };
  const entry = { at, reason: reason.slice(0, LIMITS.maxHistoryReason), plan: state.plan };
  return { plan, past: [...state.past, entry].slice(-LIMITS.maxHistory), future: [] };
}

function undo(state: StoreState): StoreState {
  const previous = state.past.at(-1);
  if (!previous || !state.plan) return state;
  return {
    plan: previous.plan,
    past: state.past.slice(0, -1),
    future: [{ at: previous.at, reason: previous.reason, plan: state.plan }, ...state.future],
  };
}

function redo(state: StoreState): StoreState {
  const next = state.future[0];
  if (!next || !state.plan) return state;
  return {
    plan: next.plan,
    past: [...state.past, { at: next.at, reason: next.reason, plan: state.plan }],
    future: state.future.slice(1),
  };
}

type PlanAction = Exclude<StoreAction, { type: 'plan/open' | 'history/undo' | 'history/redo' }>;

function withoutRate(plan: PlanState, category: Category): PlanState | null {
  if (!plan.profile.rateOverrides[category]) return null;
  const { [category]: _removed, ...rateOverrides } = plan.profile.rateOverrides;
  return { ...plan, profile: { ...plan.profile, rateOverrides } };
}

function withProgress(
  plan: PlanState,
  taskId: string,
  change: { done?: boolean; delayDays?: number },
): PlanState {
  const current = plan.progress[taskId] ?? { done: false, delayDays: 0 };
  return { ...plan, progress: { ...plan.progress, [taskId]: { ...current, ...change } } };
}

/** Accepting a quote moves the category's previously accepted quote back to the shortlist. */
function withQuoteStatus(plan: PlanState, target: Quote, status: QuoteStatus): PlanState {
  const quotes = plan.quotes.map((quote) => {
    if (quote.id === target.id) return { ...quote, status };
    const displaced =
      status === 'accepted' && quote.category === target.category && quote.status === 'accepted';
    return displaced ? { ...quote, status: 'shortlisted' as const } : quote;
  });
  return { ...plan, quotes };
}

function assertNever(action: never): never {
  throw new Error(`Unknown action: ${JSON.stringify(action)}`);
}

/** Actions that edit the open plan. Returns the unchanged state when the action does not apply. */
function reducePlan(state: StoreState, plan: PlanState, action: PlanAction): StoreState {
  switch (action.type) {
    case 'plan/patch':
      return commit(state, withProfilePatch(plan, action.patch), action.reason, action.at);
    case 'plan/resetRate': {
      const next = withoutRate(plan, action.category);
      return next ? commit(state, next, action.reason, action.at) : state;
    }
    case 'task/setDone': {
      const verb = action.done ? 'Marked done' : 'Reopened';
      const next = withProgress(plan, action.taskId, { done: action.done });
      return commit(state, next, `${verb}: ${action.title}`, action.at);
    }
    case 'task/delay': {
      const delayDays = clampDelay(action.days, LIMITS.maxDelayDays);
      const reason =
        delayDays === 0
          ? `Cleared delay: ${action.title}`
          : `Delayed ${action.title} by ${String(delayDays)} days`;
      return commit(state, withProgress(plan, action.taskId, { delayDays }), reason, action.at);
    }
    case 'quote/add': {
      if (plan.quotes.length >= LIMITS.maxQuotes) return state;
      const next = { ...plan, quotes: [...plan.quotes, action.quote] };
      return commit(state, next, `Added quote: ${action.quote.vendorLabel}`, action.at);
    }
    case 'quote/setStatus': {
      const target = plan.quotes.find((quote) => quote.id === action.id);
      if (!target) return state;
      const verb = action.status === 'accepted' ? 'Accepted' : 'Updated';
      const next = withQuoteStatus(plan, target, action.status);
      return commit(state, next, `${verb} quote: ${target.vendorLabel}`, action.at);
    }
    case 'quote/remove': {
      const target = plan.quotes.find((quote) => quote.id === action.id);
      if (!target) return state;
      const next = { ...plan, quotes: plan.quotes.filter((quote) => quote.id !== action.id) };
      return commit(state, next, `Removed quote: ${target.vendorLabel}`, action.at);
    }
    case 'ideas/set':
      return { ...state, plan: { ...plan, ideas: action.ideas } };
    case 'vendorQuestions/set': {
      const vendorQuestions = { ...plan.vendorQuestions, [action.category]: action.value };
      return { ...state, plan: { ...plan, vendorQuestions } };
    }
    case 'history/restore': {
      const snapshot = state.past[action.index];
      if (!snapshot) return state;
      const reason = `Restored the version from before “${snapshot.reason}”`;
      return commit(state, snapshot.plan, reason, action.at);
    }
    default:
      return assertNever(action);
  }
}

/** The store reducer. Actions that do not apply leave the state unchanged. */
export function storeReducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case 'plan/open':
      return commit(state, action.plan, action.reason, action.at);
    case 'history/undo':
      return undo(state);
    case 'history/redo':
      return redo(state);
    default:
      return state.plan ? reducePlan(state, state.plan, action) : state;
  }
}
