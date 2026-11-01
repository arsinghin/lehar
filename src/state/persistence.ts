/**
 * localStorage persistence. Everything read back is validated with zod, so a corrupted or
 * hand-edited store can never crash the app or inject unexpected data.
 */
import { LIMITS } from '../core/constants/limits';
import {
  PersistedStoreSchema,
  PlanStateSchema,
  type PersistedStore,
  type PlanState,
} from '../core/schemas';
import type { StoreState } from './store';

export const STORAGE_KEY = 'lehar:store:v1';
/** Keep the stored history short. 10 versions is plenty, and it keeps the store small. */
export const PERSISTED_HISTORY = 10;
export const MAX_IMPORT_BYTES = 200 * 1024;

export type LoadResult =
  | { status: 'empty' }
  | { status: 'loaded'; store: StoreState }
  | { status: 'invalid' }
  | { status: 'unavailable' };

/** The saved store, or why there is none (empty, damaged or storage blocked). */
export function loadStore(storage: Pick<Storage, 'getItem'> | null): LoadResult {
  if (!storage) return { status: 'unavailable' };
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'unavailable' };
  }
  if (raw === null) return { status: 'empty' };
  try {
    const parsed = PersistedStoreSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { status: 'invalid' };
    return {
      status: 'loaded',
      store: { plan: parsed.data.plan, past: parsed.data.past, future: [] },
    };
  } catch {
    return { status: 'invalid' };
  }
}

/** Returns false when the browser refuses to store (private mode, quota, disabled). */
export function saveStore(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null,
  state: StoreState,
): boolean {
  if (!storage) return false;
  try {
    if (!state.plan) {
      storage.removeItem(STORAGE_KEY);
      return true;
    }
    const persisted: PersistedStore = {
      storeVersion: 1,
      plan: state.plan,
      past: state.past.slice(-Math.min(PERSISTED_HISTORY, LIMITS.maxHistory)),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    return true;
  } catch {
    return false;
  }
}

/** True when the browser actually accepts writes (private modes and policies can silently block them). */
export function isStorageWritable(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null,
): boolean {
  if (!storage) return false;
  const probe = `${STORAGE_KEY}:probe`;
  try {
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** localStorage, or null when the browser blocks it. */
export function safeLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export type ImportResult = { ok: true; plan: PlanState } | { ok: false; message: string };

/** Validates a plan file the user chose to import. */
export function parsePlanFile(text: string): ImportResult {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    return { ok: false, message: 'That file is too large to be a Lehar plan.' };
  }
  try {
    const parsed = PlanStateSchema.safeParse(JSON.parse(text));
    return parsed.success
      ? { ok: true, plan: parsed.data }
      : { ok: false, message: 'That file is not a valid Lehar plan.' };
  } catch {
    return { ok: false, message: 'That file is not valid JSON.' };
  }
}
