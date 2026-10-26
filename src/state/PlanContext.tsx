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

import { todayIso } from '../core/dates';
import { derivePlan, type DerivedPlan } from '../core/plan';
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
  today: string;
  storageIssue: StorageIssue;
}

const PlanContext = createContext<PlanContextValue | null>(null);

function initialState(result: LoadResult): StoreState {
  return result.status === 'loaded' ? result.store : EMPTY_STORE;
}

export function PlanProvider({
  children,
  today: fixedToday,
}: {
  children: ReactNode;
  today?: string;
}) {
  const [boot] = useState(() => {
    const storage = safeLocalStorage();
    return { loaded: loadStore(storage), writable: isStorageWritable(storage) };
  });
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
  const storageIssue: StorageIssue =
    boot.loaded.status === 'unavailable' || !boot.writable
      ? 'unavailable'
      : boot.loaded.status === 'invalid'
        ? 'invalid'
        : 'none';

  const value = useMemo(
    () => ({ state, dispatch, derived, today, storageIssue }),
    [state, derived, today, storageIssue],
  );
  return <PlanContext value={value}>{children}</PlanContext>;
}

export function usePlanStore(): PlanContextValue {
  const context = use(PlanContext);
  if (!context) throw new Error('usePlanStore must be used inside <PlanProvider>');
  return context;
}

/** For screens that only render with an open plan. */
export function useOpenPlan() {
  const { state, derived, ...rest } = usePlanStore();
  if (!state.plan || !derived) throw new Error('No plan is open');
  return { ...rest, state, plan: state.plan, derived };
}

export function nowIso(): string {
  return new Date().toISOString();
}
