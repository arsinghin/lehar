import { useNotify } from '../../components/Notice';
import type { ProfilePatch } from '../../core/profile';
import { useOpenPlan } from '../../state/PlanContext';
import { actions } from '../../state/store';
import { rippleMessage } from './ripple';

/**
 * Applies a profile edit and tells the host what it did to the total, in that order, everywhere.
 * `what` names the edit in the message; `reason` (defaults to `what`) is what History shows.
 */
export function useRipplePatch(): (patch: ProfilePatch, what: string, reason?: string) => void {
  const { plan, dispatch } = useOpenPlan();
  const notify = useNotify();
  return (patch, what, reason = what) => {
    notify(rippleMessage(plan, patch, what));
    dispatch(actions.patchPlan(patch, reason));
  };
}
