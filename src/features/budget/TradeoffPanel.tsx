import { useMemo, useState } from 'react';

import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { useNotify } from '../../components/Notice';
import { budgetToCover, type BudgetSummary } from '../../core/budget';
import { formatInr } from '../../core/money';
import { combineLeverPatches, previewLevers } from '../../core/tradeoffs';
import { plural } from '../../lib/util';
import { useOpenPlan } from '../../state/PlanContext';
import { actions } from '../../state/store';
import { LeverList } from './LeverList';
import { rippleFromSummaries } from './ripple';

/**
 * When the plan is over budget: show the trade-offs and let the family choose. Lehar suggests a
 * combination but never pre-selects it or applies anything on its own.
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
  const coveringBudget = budgetToCover(budget.total);

  const apply = () => {
    const reason = `Trade-offs: ${chosen.map((lever) => lever.title).join('; ')}`;
    dispatch(actions.patchPlan(combineLeverPatches(plan.profile, chosen), reason));
    notify(rippleFromSummaries(budget, preview, `Applied ${plural(chosen.length, 'trade-off')}`));
    setSelected([]);
  };

  const raiseBudget = () => {
    dispatch(
      actions.patchPlan(
        { budget: coveringBudget },
        `Raised budget to ${formatInr(coveringBudget)}`,
      ),
    );
    notify({
      tone: 'ok',
      text: `Budget raised to ${formatInr(coveringBudget)}. The plan now fits.`,
    });
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

      <LeverList
        levers={tradeoffs.levers}
        suggestedIds={tradeoffs.suggestedIds}
        selected={selected}
        onChange={setSelected}
      />

      <div className="tradeoffs__summary" aria-live="polite">
        <SelectionSummary count={chosen.length} preview={preview} />
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
          Or raise the budget to {formatInr(coveringBudget)}
        </Button>
      </div>
    </section>
  );
}

function SelectionSummary({ count, preview }: { count: number; preview: BudgetSummary }) {
  if (count === 0) return <p className="muted">Nothing selected yet.</p>;
  return (
    <p>
      With {count} selected: new total <strong className="num">{formatInr(preview.total)}</strong>,{' '}
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
  );
}
