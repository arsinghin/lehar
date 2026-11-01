/**
 * State for the "Something changed?" flow: the typed text, its interpretation and the resulting diff.
 * Editing the text discards any preview, including one that is still being worked out, so a
 * preview can never be applied to text other than the text it was made from.
 */
import { useMemo, useState } from 'react';

import { diffPlans, type PlanDiff } from '../../core/changes/diff';
import { resolveChanges, type ResolvedChange } from '../../core/changes/resolveChanges';
import type { AiSource } from '../../core/constants/enums';
import { withProfilePatch } from '../../core/plan';
import { AiInputError, interpretChange } from '../../lib/aiActions';
import { useLatestOnly } from '../../lib/useLatestOnly';
import { useOpenPlan } from '../../state/PlanContext';

/** Shorter input cannot describe a change. */
const MIN_CHANGE_TEXT = 2;

export interface Interpretation {
  resolved: ResolvedChange;
  clarifications: string[];
  source: AiSource;
  notice: string | null;
}

export interface ChangePreview {
  text: string;
  setText: (text: string) => void;
  preview: () => Promise<void>;
  pending: boolean;
  inputError: string | undefined;
  result: Interpretation | null;
  /** Before/after comparison, present when the change would alter the plan. */
  diff: PlanDiff | null;
}

/** Text, interpretation and diff for one "Something changed?" session. */
export function useChangePreview(initialText: string): ChangePreview {
  const { plan, today } = useOpenPlan();
  const latest = useLatestOnly();
  const [text, setTextState] = useState(initialText);
  const [pending, setPending] = useState(false);
  const [inputError, setInputError] = useState<string | undefined>();
  const [result, setResult] = useState<Interpretation | null>(null);

  const after = useMemo(
    () =>
      result && Object.keys(result.resolved.patch).length > 0
        ? withProfilePatch(plan, result.resolved.patch)
        : null,
    [plan, result],
  );
  const diff = useMemo(() => (after ? diffPlans(plan, after, today) : null), [plan, after, today]);

  const setText = (next: string) => {
    setTextState(next);
    setResult(null);
    latest.invalidate();
  };

  const preview = async () => {
    const trimmed = text.trim();
    if (trimmed.length < MIN_CHANGE_TEXT) {
      setInputError('Describe what changed, for example “50 more guests”.');
      return;
    }
    setInputError(undefined);
    const token = latest.begin();
    setPending(true);
    try {
      const interpreted = await interpretChange(plan.profile, trimmed, today);
      if (!latest.isCurrent(token)) return;
      const { guests, budget, eventDate } = plan.profile;
      setResult({
        resolved: resolveChanges(interpreted.parsed.changes, { guests, budget, eventDate, today }),
        clarifications: interpreted.parsed.clarifications,
        source: interpreted.source,
        notice: interpreted.notice,
      });
    } catch (error) {
      setInputError(
        error instanceof AiInputError
          ? error.message
          : 'Could not read that change. Please rephrase it.',
      );
    } finally {
      setPending(false);
    }
  };

  return { text, setText, preview, pending, inputError, result, diff };
}
