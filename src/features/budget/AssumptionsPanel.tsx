import { useState } from 'react';

import { Button } from '../../components/Button';
import { useNotify } from '../../components/Notice';
import { CATEGORY_LABELS, type Category } from '../../core/constants/enums';
import { LIMITS } from '../../core/constants/limits';
import { RATE_BASIS } from '../../core/constants/rates';
import { formatInr } from '../../core/money';
import type { BudgetLine } from '../../core/budget';
import type { Rate } from '../../core/constants/rates';
import { nowIso, useOpenPlan } from '../../state/PlanContext';
import { rippleMessage } from './ripple';

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

function parseRate(value: string, max: number): number | null {
  const trimmed = value.trim().replace(/,/g, '');
  if (!/^\d+$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  return amount <= max ? amount : null;
}

function RateEditor({ line }: { line: BudgetLine }) {
  const { plan, dispatch } = useOpenPlan();
  const notify = useNotify();
  const [perGuest, setPerGuest] = useState(toInput(line.rate.perGuest));
  const [fixed, setFixed] = useState(toInput(line.rate.fixed));
  const [error, setError] = useState<string | null>(null);
  const category: Category = line.category;
  const label = CATEGORY_LABELS[category];

  const save = () => {
    const rate: Rate | null = (() => {
      const g = parseRate(perGuest, LIMITS.maxRatePerGuest);
      const f = parseRate(fixed, LIMITS.maxRateFixed);
      return g === null || f === null ? null : { perGuest: g, fixed: f };
    })();
    if (!rate) {
      setError('Enter whole rupee amounts.');
      return;
    }
    setError(null);
    const patch = { rateOverrides: { [category]: rate } };
    notify(rippleMessage(plan, patch, `${label}: your own rate`));
    dispatch({ type: 'plan/patch', patch, reason: `Custom rate for ${label}`, at: nowIso() });
  };

  const reset = () => {
    dispatch({
      type: 'plan/resetRate',
      category,
      reason: `Reset ${label} to the default rate`,
      at: nowIso(),
    });
    notify({ tone: 'info', text: `${label} is back to Lehar’s default assumption.` });
  };

  const errorId = `rate-${category}-error`;
  return (
    <fieldset className="rate-editor" aria-describedby={error ? errorId : undefined}>
      <legend>
        {label} <span className="muted small">· {RATE_BASIS[category]}</span>
      </legend>
      <div className="row">
        <label className="field">
          <span className="field__label small">Per guest (₹)</span>
          <input
            className="input input--narrow"
            inputMode="numeric"
            value={perGuest}
            onChange={(event) => {
              setPerGuest(event.target.value);
            }}
          />
        </label>
        <label className="field">
          <span className="field__label small">Fixed (₹)</span>
          <input
            className="input input--narrow"
            inputMode="numeric"
            value={fixed}
            onChange={(event) => {
              setFixed(event.target.value);
            }}
          />
        </label>
        <span className="small muted">
          Now {formatInr(line.estimate)} for {plan.profile.guests} guests
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
