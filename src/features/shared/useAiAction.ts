/**
 * One way to run an AI action for the open plan: a pending flag, the notice the host sees, a single
 * error path, and a guard that drops a late answer if the plan changed while the request was out.
 */
import { useEffect, useState } from 'react';

import { useNotify } from '../../components/Notice';
import { AiInputError, type AiOutcome } from '../../lib/aiActions';
import { useLatestOnly } from '../../lib/useLatestOnly';
import { useOpenPlan } from '../../state/PlanContext';
import type { StoreAction } from '../../state/store';

export interface AiActionSpec<T> {
  request: () => Promise<AiOutcome<T>>;
  /** Turns the answer into the store action that saves it. */
  save: (value: T) => StoreAction;
  /** Shown when the AI answered normally. */
  success: string;
  /** Shown when the request failed for an unexpected reason. */
  failure: string;
}

export interface AiAction {
  /** Key of the action in flight, or null. Lets one screen run several kinds of action. */
  pending: string | null;
  run<T>(key: string, spec: AiActionSpec<T>): Promise<void>;
}

/** Runs AI actions for the open plan; see AiActionSpec. */
export function useAiAction(): AiAction {
  const { plan, dispatch } = useOpenPlan();
  const notify = useNotify();
  const latest = useLatestOnly();
  const [pending, setPending] = useState<string | null>(null);

  // An answer computed for the previous profile must not overwrite the new one.
  useEffect(() => {
    latest.invalidate();
  }, [latest, plan.profile]);

  const run = async <T>(key: string, spec: AiActionSpec<T>) => {
    const token = latest.begin();
    setPending(key);
    try {
      const outcome = await spec.request();
      if (!latest.isCurrent(token)) {
        notify({
          tone: 'info',
          text: 'The plan changed while waiting, so that answer was dropped.',
        });
        return;
      }
      dispatch(spec.save(outcome.value));
      notify(
        outcome.notice
          ? { tone: 'info', text: outcome.notice }
          : { tone: 'ok', text: spec.success },
      );
    } catch (error) {
      notify({
        tone: 'danger',
        text: error instanceof AiInputError ? error.message : spec.failure,
      });
    } finally {
      setPending(null);
    }
  };

  return { pending, run };
}
