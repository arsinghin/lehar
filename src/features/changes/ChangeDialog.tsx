import { useMemo, useState } from 'react';

import { Alert, SourceBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { TextAreaField } from '../../components/Field';
import { useNotify } from '../../components/Notice';
import { diffPlans } from '../../core/changes/diff';
import { resolveChanges, type ResolvedChange } from '../../core/changes/parseChange';
import type { AiSource } from '../../core/constants/enums';
import { LIMITS } from '../../core/constants/limits';
import { CHANGE_TEST_TEXT, withProfilePatch } from '../../core/plan';
import { AiInputError, interpretChange } from '../../lib/aiActions';
import { nowIso, useOpenPlan } from '../../state/PlanContext';
import { DiffPreview } from './DiffPreview';

const EXAMPLES = [
  '50 more guests',
  'Budget down 10%',
  '2 weeks earlier',
  'Budget is now 7 lakh',
] as const;

interface Interpretation {
  resolved: ResolvedChange;
  clarifications: string[];
  source: AiSource;
  notice: string | null;
}

export function ChangeDialog({
  open,
  initialText,
  onClose,
}: {
  open: boolean;
  initialText: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} title="Something changed?" onClose={onClose}>
      {open ? <ChangeFlow initialText={initialText} onClose={onClose} /> : null}
    </Dialog>
  );
}

function ChangeFlow({ initialText, onClose }: { initialText: string; onClose: () => void }) {
  const { plan, today, dispatch } = useOpenPlan();
  const notify = useNotify();
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
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

  const preview = async () => {
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setInputError('Describe what changed, for example “50 more guests”.');
      return;
    }
    setInputError(undefined);
    setBusy(true);
    try {
      const interpreted = await interpretChange(plan.profile, trimmed, today);
      const resolved = resolveChanges(interpreted.parsed.changes, {
        guests: plan.profile.guests,
        budget: plan.profile.budget,
        eventDate: plan.profile.eventDate,
        today,
      });
      setResult({
        resolved,
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
      setBusy(false);
    }
  };

  const apply = () => {
    if (!result || !after) return;
    const reason = result.resolved.summary.join('; ');
    dispatch({
      type: 'plan/patch',
      patch: result.resolved.patch,
      reason: `Change: ${reason}`,
      at: nowIso(),
    });
    notify({
      tone: diff?.budget.after.status === 'over' ? 'warn' : 'ok',
      text: `Applied: ${reason}. ${diff?.budget.after.status === 'over' ? 'Open Budget to choose trade-offs.' : 'The plan still fits.'} You can undo this from History.`,
    });
    onClose();
  };

  return (
    <div className="stack">
      <p className="muted">
        Describe it the way you would tell a friend. Lehar works out the ripple first. Nothing
        changes until you apply it.
      </p>
      <form
        noValidate
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void preview();
        }}
      >
        <TextAreaField
          label="What changed?"
          hint="Guests, budget or date. You can mention several at once."
          rows={3}
          maxLength={LIMITS.maxChangeText}
          value={text}
          error={inputError}
          onChange={(event) => {
            setText(event.target.value);
            setResult(null);
          }}
        />
        <div className="row" role="group" aria-label="Examples">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="chip"
              onClick={() => {
                setText(example);
                setResult(null);
              }}
            >
              {example}
            </button>
          ))}
          <button
            type="button"
            className="chip"
            onClick={() => {
              setText(CHANGE_TEST_TEXT);
              setResult(null);
            }}
          >
            All three at once
          </button>
        </div>
        <div>
          <Button
            type="submit"
            variant={result ? 'secondary' : 'primary'}
            icon="ripple"
            busy={busy}
          >
            Preview the ripple
          </Button>
        </div>
      </form>

      <div aria-live="polite" className="stack">
        {result?.notice ? (
          <Alert tone="info">
            <p>{result.notice}</p>
          </Alert>
        ) : null}
        {result && result.clarifications.length > 0 && !diff ? (
          <Alert tone="warn" title="Lehar needs a little more detail">
            <ul>
              {result.clarifications.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {result && result.resolved.errors.length > 0 ? (
          <Alert tone="danger" title="That change is not possible">
            <ul>
              {result.resolved.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {result && diff ? (
          <>
            <div className="row">
              <strong>Understood as:</strong> <SourceBadge source={result.source} />
            </div>
            {result.source !== 'rules' ? (
              <p className="small">
                Interpreted by AI. Please check that this matches what you meant.
              </p>
            ) : null}
            {result.clarifications.length > 0 ? (
              <p className="small">Also: {result.clarifications.join(' ')}</p>
            ) : null}
            <DiffPreview diff={diff} />
          </>
        ) : null}
      </div>

      <div className="dialog__actions row">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" icon="check" disabled={!diff} onClick={apply}>
          Apply changes
        </Button>
      </div>
    </div>
  );
}
