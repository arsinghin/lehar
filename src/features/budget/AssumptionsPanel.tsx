import { useId, useState } from 'react';

import { Button } from '../../components/Button';
import { TextField } from '../../components/Field';
import { useNotify } from '../../components/Notice';
import { CATEGORY_LABELS } from '../../core/constants/enums';
import { LIMITS } from '../../core/constants/limits';
import { RATE_BASIS, type Rate } from '../../core/constants/rates';
import { formatInr, formatNumber } from '../../core/money';
import { parseWholeNumber } from '../../core/validation';
import type { BudgetLine } from '../../core/budget';
import { useOpenPlan } from '../../state/PlanContext';
import { actions } from '../../state/store';
import { useRipplePatch } from './useRipplePatch';

/** Every estimate is backed by a visible, editable assumption, so nothing is a black box. */
export function AssumptionsPanel() {
  const { derived } = useOpenPlan();
  return (
    <details className="details">
      <summary>See and edit the price assumptions behind every estimate</summary>
      <p className="small muted">
        These are planning assumptions for a mid-range Indian city, not vendor prices. Replace them
        with what you hear locally, or accept a real quote in Vendors to override the estimate
        completely.
      </p>
      <div className="stack">
        {derived.budget.lines.map((line) => (
          <RateEditor
            key={`${line.category}-${String(line.rate.perGuest)}-${String(line.rate.fixed)}`}
            line={line}
          />
        ))}
      </div>
    </details>
  );
}

function toInput(value: number): string {
  return String(Math.round(value));
}

/** Edit the per-guest and fixed rate behind one category's estimate, or reset it to the default. */
function RateEditor({ line }: { line: BudgetLine }) {
  const { plan, dispatch } = useOpenPlan();
  const notify = useNotify();
  const patchWithRipple = useRipplePatch();
  const [perGuest, setPerGuest] = useState(toInput(line.rate.perGuest));
  const [fixed, setFixed] = useState(toInput(line.rate.fixed));
  const [error, setError] = useState<string | undefined>();
  const { category } = line;
  const label = CATEGORY_LABELS[category];
  const errorId = useId();

  const save = () => {
    const perGuestValue = parseWholeNumber(perGuest, LIMITS.maxRatePerGuest);
    const fixedValue = parseWholeNumber(fixed, LIMITS.maxRateFixed);
    if (perGuestValue === null || fixedValue === null) {
      setError('Enter whole rupee amounts.');
      return;
    }
    setError(undefined);
    const rate: Rate = { perGuest: perGuestValue, fixed: fixedValue };
    patchWithRipple(
      { rateOverrides: { [category]: rate } },
      `${label}: your own rate`,
      `Custom rate for ${label}`,
    );
  };

  const reset = () => {
    dispatch(actions.resetRate(category, `Reset ${label} to the default rate`));
    notify({ tone: 'info', text: `${label} is back to Lehar’s default assumption.` });
  };

  return (
    <fieldset className="rate-editor" aria-describedby={error ? errorId : undefined}>
      <legend>
        {label} <span className="muted small">· {RATE_BASIS[category]}</span>
      </legend>
      <div className="row">
        <TextField
          label={<span className="small">Per guest (₹)</span>}
          className="field--narrow"
          inputMode="numeric"
          value={perGuest}
          onChange={(event) => {
            setPerGuest(event.target.value);
          }}
        />
        <TextField
          label={<span className="small">Fixed (₹)</span>}
          className="field--narrow"
          inputMode="numeric"
          value={fixed}
          onChange={(event) => {
            setFixed(event.target.value);
          }}
        />
        <span className="small muted">
          Now {formatInr(line.estimate)} for {formatNumber(plan.profile.guests)} guests
        </span>
        <Button aria-label={`Save ${label} rate`} size="s" onClick={save}>
          Save
        </Button>
        {line.rateIsCustom ? (
          <Button aria-label={`Reset ${label} rate`} size="s" variant="ghost" onClick={reset}>
            Reset
          </Button>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="field__error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
