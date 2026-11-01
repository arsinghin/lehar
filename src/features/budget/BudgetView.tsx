import { formatInr } from '../../core/money';
import { useOpenPlan } from '../../state/PlanContext';
import { BudgetStatusBadge } from '../shared/StatusBadges';
import { AssumptionsPanel } from './AssumptionsPanel';
import { BudgetTable } from './BudgetTable';
import { TradeoffPanel } from './TradeoffPanel';
import { WhatIfForm } from './WhatIfForm';

/** The budget: headline figures, every line, trade-offs when over, what-ifs and the assumptions. */
export function BudgetView() {
  const { plan, derived } = useOpenPlan();
  const { budget } = derived;

  return (
    <div className="stack-l">
      <section aria-labelledby="budget-title" className="stack">
        <div className="card__title">
          <h2 id="budget-title">Budget by category</h2>
          <BudgetStatusBadge status={budget.status} />
        </div>
        <dl className="stat-row">
          <div>
            <dt>Your budget</dt>
            <dd className="num">{formatInr(budget.budget)}</dd>
          </div>
          <div>
            <dt>Estimated total</dt>
            <dd className="num">{formatInr(budget.total)}</dd>
          </div>
          <div>
            <dt>{budget.gap > 0 ? 'Over by' : 'Left'}</dt>
            <dd className="num">{formatInr(Math.abs(budget.gap))}</dd>
          </div>
          <div>
            <dt>Per guest</dt>
            <dd className="num">{formatInr(budget.perGuest)}</dd>
          </div>
        </dl>

        <BudgetTable />
      </section>

      <TradeoffPanel />

      <WhatIfForm key={`${String(plan.profile.guests)}-${String(plan.profile.budget)}`} />

      <AssumptionsPanel />
    </div>
  );
}
