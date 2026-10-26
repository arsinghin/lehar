import { useMemo, useState } from 'react';

import { Alert, Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { useNotify } from '../../components/Notice';
import { formatInr } from '../../core/money';
import { combineLeverPatches, previewLevers } from '../../core/tradeoffs';
import { nowIso, useOpenPlan } from '../../state/PlanContext';
import { rippleFromSummaries } from './ripple';

/**
 * The over-budget scenario (e.g. 20% over): show the trade-offs and let the family choose. Lehar suggests
 * a combination but never pre-selects it or applies anything on its own.
 */
export function TradeoffPanel() {
  const { plan, derived, dispatch } = useOpenPlan();
  const notify = useNotify();
  const { tradeoffs, budget } = derived;
  const [selected, setSelected] = useState<string[]>([]);

  const chosen = useMemo(
    () => tradeoffs.levers.filter((lever) => selected.includes(lever.id)),
    [tradeoffs.levers, selected],
  );
  const preview = useMemo(() => previewLevers(plan.profile, plan.quotes, chosen), [plan, chosen]);

  if (budget.gap <= 0) return null;

  const apply = () => {
    const patch = combineLeverPatches(plan.profile, chosen);
    dispatch({
      type: 'plan/patch',
      patch,
      reason: `Trade-offs: ${chosen.map((lever) => lever.title).join('; ')}`,
      at: nowIso(),
    });
    notify(
      rippleFromSummaries(
        budget,
        preview,
        `Applied ${chosen.length} trade-off${chosen.length === 1 ? '' : 's'}`,
      ),
    );
    setSelected([]);
  };

  const raiseBudget = () => {
    const newBudget = Math.ceil(budget.total / 1000) * 1000;
    dispatch({
      type: 'plan/patch',
      patch: { budget: newBudget },
      reason: `Raised budget to ${formatInr(newBudget)}`,
      at: nowIso(),
    });
    notify({ tone: 'ok', text: `Budget raised to ${formatInr(newBudget)}. The plan now fits.` });
  };

  return (
    <section className="card tradeoffs" aria-labelledby="tradeoffs-title">
      <h2 id="tradeoffs-title">
        You are {formatInr(budget.gap)} ({Math.round(budget.gapRatio * 100)}%) over. What matters
        most?
      </h2>
      <p className="muted">
        Lehar never cuts blindly. Each option shows what it saves and which of your priorities it
        touches. Options that hurt least for the money come first. Protected areas are never
        touched.
      </p>

      {tradeoffs.levers.length === 0 ? (
        <Alert tone="warn" title="Nothing left to trim">
          <p>
            Everything left is protected or already at its simplest. Consider raising the budget or
            unprotecting an area.
          </p>
        </Alert>
      ) : (
        <fieldset>
          <legend>Choose the trade-offs you are comfortable with</legend>
          <ul className="lever-list">
            {tradeoffs.levers.map((lever) => {
              const checked = selected.includes(lever.id);
              const conflicts =
                lever.category !== undefined &&
                chosen.some((other) => other.id !== lever.id && other.category === lever.category);
              return (
                <li key={lever.id}>
                  <label className="choice lever">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={conflicts && !checked}
                      onChange={() => {
                        setSelected(
                          checked
                            ? selected.filter((id) => id !== lever.id)
                            : [...selected, lever.id],
                        );
                      }}
                    />
                    <span className="choice__text">
                      <span>
                        <strong>{lever.title}</strong>{' '}
                        {tradeoffs.suggestedIds.includes(lever.id) ? (
                          <Badge tone="info">Suggested</Badge>
                        ) : null}
                      </span>
                      <span className="choice__desc">{lever.detail}</span>
                      <span className="small">
                        Saves about <strong className="num">{formatInr(lever.saving)}</strong>
                        {lever.kind === 'tier-down' || lever.kind === 'skip-category'
                          ? ` · you rated this ${Math.floor(lever.pain)} of 5`
                          : ''}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      <div className="tradeoffs__summary" aria-live="polite">
        {chosen.length > 0 ? (
          <p>
            With {chosen.length} selected: new total{' '}
            <strong className="num">{formatInr(preview.total)}</strong>,{' '}
            {preview.gap <= 0 ? (
              <Badge tone="ok" icon="check">
                within budget ({formatInr(-preview.gap)} left)
              </Badge>
            ) : (
              <Badge tone="warn" icon="alert">
                still {formatInr(preview.gap)} over
              </Badge>
            )}
          </p>
        ) : (
          <p className="muted">Nothing selected yet.</p>
        )}
      </div>

      <div className="row">
        {tradeoffs.suggestedIds.length > 0 ? (
          <Button
            onClick={() => {
              setSelected(tradeoffs.suggestedIds);
            }}
          >
            {tradeoffs.suggestionClosesGap
              ? 'Select Lehar’s suggestion'
              : 'Select the biggest savings'}
          </Button>
        ) : null}
        <Button variant="primary" disabled={chosen.length === 0} onClick={apply}>
          Apply selected
        </Button>
        <Button variant="ghost" onClick={raiseBudget}>
          Or raise the budget to {formatInr(Math.ceil(budget.total / 1000) * 1000)}
        </Button>
      </div>
    </section>
  );
}
