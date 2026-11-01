/** React bindings for the store: hydration, persistence, derived plan and today's date. */
import {
  createContext,
  use,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';

import { todayIso, type IsoDate } from '../core/dates';
import { derivePlan, type DerivedPlan } from '../core/plan';
import type { PlanState } from '../core/schemas';
import {
  isStorageWritable,
  loadStore,
  safeLocalStorage,
  saveStore,
  type LoadResult,
} from './persistence';
import { EMPTY_STORE, storeReducer, type StoreAction, type StoreState } from './store';

export type StorageIssue = 'none' | 'unavailable' | 'invalid';

interface PlanContextValue {
  state: StoreState;
  dispatch: Dispatch<StoreAction>;
  derived: DerivedPlan | null;
  today: IsoDate;
  storageIssue: StorageIssue;
}

export interface OpenPlanValue extends Omit<PlanContextValue, 'derived'> {
  plan: PlanState;
  derived: DerivedPlan;
}

export interface PlanProviderProps {
  children: ReactNode;
  /** Fixes "today" (tests and demos); defaults to the real date. */
  today?: IsoDate;
}

const PlanContext = createContext<PlanContextValue | null>(null);

function initialState(result: LoadResult): StoreState {
  return result.status === 'loaded' ? result.store : EMPTY_STORE;
}

function storageIssueOf(loaded: LoadResult, writable: boolean): StorageIssue {
  if (loaded.status === 'unavailable' || !writable) return 'unavailable';
  return loaded.status === 'invalid' ? 'invalid' : 'none';
}

/** Loads the saved plan once, keeps it saved, and provides the store and the derived plan. */
export function PlanProvider({ children, today: fixedToday }: PlanProviderProps) {
  const [boot] = useState(() => {
    const storage = safeLocalStorage();
    const loaded = loadStore(storage);
    return { loaded, storageIssue: storageIssueOf(loaded, isStorageWritable(storage)) };
  });
  const { storageIssue } = boot;
  const [state, dispatch] = useReducer(storeReducer, boot.loaded, initialState);
  const today = fixedToday ?? todayIso();

  // Persisting is a side effect on an external system, which is exactly what effects are for.
  useEffect(() => {
    saveStore(safeLocalStorage(), state);
  }, [state]);

  const derived = useMemo(
    () => (state.plan ? derivePlan(state.plan, today) : null),
    [state.plan, today],
  );
  const value = useMemo(
    () => ({ state, dispatch, derived, today, storageIssue }),
    [state, derived, today, storageIssue],
  );
  return <PlanContext value={value}>{children}</PlanContext>;
}

/** The store, whether or not a plan is open. */
export function usePlanStore(): PlanContextValue {
  const context = use(PlanContext);
  if (!context) throw new Error('usePlanStore must be used inside <PlanProvider>');
  return context;
}

/** For screens that only render with an open plan. */
export function useOpenPlan(): OpenPlanValue {
  const { state, derived, ...rest } = usePlanStore();
  if (!state.plan || !derived) throw new Error('No plan is open');
  return { ...rest, state, plan: state.plan, derived };
}
