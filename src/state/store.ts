/**
 * App store: the current plan plus undo/redo history. Every meaningful edit is a commit, so any
 * change, trade-off or what-if can be undone or restored later. Pure reducer, fully unit tested.
 */
import { LIMITS } from '../core/constants/limits';
import type { Category, QuoteStatus } from '../core/constants/enums';
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

export const EMPTY_STORE: StoreState = { plan: null, past: [], future: [] };

function commit(state: StoreState, plan: PlanState, reason: string, at: string): StoreState {
  if (!state.plan) return { plan, past: [], future: [] };
  const past = [...state.past, { at, reason: reason.slice(0, 160), plan: state.plan }].slice(
    -LIMITS.maxHistory,
  );
  return { plan, past, future: [] };
}

function updateQuotes(plan: PlanState, quotes: Quote[]): PlanState {
  return { ...plan, quotes };
}

export function storeReducer(state: StoreState, action: StoreAction): StoreState {
  if (action.type === 'plan/open') {
    return state.plan
      ? commit(state, action.plan, action.reason, action.at)
      : { plan: action.plan, past: [], future: [] };
  }
  if (action.type === 'history/undo') {
    const previous = state.past.at(-1);
    if (!previous || !state.plan) return state;
    return {
      plan: previous.plan,
      past: state.past.slice(0, -1),
      future: [{ at: previous.at, reason: previous.reason, plan: state.plan }, ...state.future],
    };
  }
  if (action.type === 'history/redo') {
    const next = state.future[0];
    if (!next || !state.plan) return state;
    return {
      plan: next.plan,
      past: [...state.past, { at: next.at, reason: next.reason, plan: state.plan }],
      future: state.future.slice(1),
    };
  }

  const plan = state.plan;
  if (!plan) return state;

  switch (action.type) {
    case 'plan/patch':
      return commit(state, withProfilePatch(plan, action.patch), action.reason, action.at);
    case 'plan/resetRate': {
      if (!plan.profile.rateOverrides[action.category]) return state;
      const { [action.category]: _removed, ...rateOverrides } = plan.profile.rateOverrides;
      return commit(
        state,
        { ...plan, profile: { ...plan.profile, rateOverrides } },
        action.reason,
        action.at,
      );
    }
    case 'task/setDone': {
      const current = plan.progress[action.taskId] ?? { done: false, delayDays: 0 };
      const progress = { ...plan.progress, [action.taskId]: { ...current, done: action.done } };
      const verb = action.done ? 'Marked done' : 'Reopened';
      return commit(state, { ...plan, progress }, `${verb}: ${action.title}`, action.at);
    }
    case 'task/delay': {
      const current = plan.progress[action.taskId] ?? { done: false, delayDays: 0 };
      const delayDays = clampDelay(action.days, LIMITS.maxDelayDays);
      const progress = { ...plan.progress, [action.taskId]: { ...current, delayDays } };
      const reason =
        delayDays === 0
          ? `Cleared delay: ${action.title}`
          : `Delayed ${action.title} by ${delayDays} days`;
      return commit(state, { ...plan, progress }, reason, action.at);
    }
    case 'quote/add':
      if (plan.quotes.length >= LIMITS.maxQuotes) return state;
      return commit(
        state,
        updateQuotes(plan, [...plan.quotes, action.quote]),
        `Added quote: ${action.quote.vendorLabel}`,
        action.at,
      );
    case 'quote/setStatus': {
      const target = plan.quotes.find((quote) => quote.id === action.id);
      if (!target) return state;
      const quotes = plan.quotes.map((quote) => {
        if (quote.id === action.id) return { ...quote, status: action.status };
        // Only one accepted quote per category: the previous one goes back to the shortlist.
        if (
          action.status === 'accepted' &&
          quote.category === target.category &&
          quote.status === 'accepted'
        ) {
          return { ...quote, status: 'shortlisted' as const };
        }
        return quote;
      });
      return commit(
        state,
        updateQuotes(plan, quotes),
        `${action.status === 'accepted' ? 'Accepted' : 'Updated'} quote: ${target.vendorLabel}`,
        action.at,
      );
    }
    case 'quote/remove': {
      const target = plan.quotes.find((quote) => quote.id === action.id);
      if (!target) return state;
      return commit(
        state,
        updateQuotes(
          plan,
          plan.quotes.filter((quote) => quote.id !== action.id),
        ),
        `Removed quote: ${target.vendorLabel}`,
        action.at,
      );
    }
    case 'ideas/set':
      return { ...state, plan: { ...plan, ideas: action.ideas } };
    case 'vendorQuestions/set':
      return {
        ...state,
        plan: {
          ...plan,
          vendorQuestions: { ...plan.vendorQuestions, [action.category]: action.value },
        },
      };
    case 'history/restore': {
      const snapshot = state.past[action.index];
      if (!snapshot) return state;
      return commit(
        state,
        snapshot.plan,
        `Restored the version from before “${snapshot.reason}”`,
        action.at,
      );
    }
  }
}
