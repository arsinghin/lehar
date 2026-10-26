import { useState } from 'react';

import { Badge, BudgetStatusBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Field';
import { TableScroll } from '../../components/TableScroll';
import { useNotify } from '../../components/Notice';
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  TIER_LABELS,
  TIERS,
  type Category,
  type Tier,
} from '../../core/constants/enums';
import { LIMITS } from '../../core/constants/limits';
import { formatInr, parseInrAmount } from '../../core/money';
import type { ProfilePatch } from '../../core/profile';
import { nowIso, useOpenPlan } from '../../state/PlanContext';
import { parseGuests } from '../intake/intakeDraft';
import { AssumptionsPanel } from './AssumptionsPanel';
import { rippleMessage } from './ripple';
import { TradeoffPanel } from './TradeoffPanel';

const BUFFER_OPTIONS = [0, 5, 10, 15, 20] as const;

export function BudgetView() {
  const { plan, derived, dispatch } = useOpenPlan();
  const notify = useNotify();
  const { budget } = derived;

  const commit = (patch: ProfilePatch, what: string) => {
    notify(rippleMessage(plan, patch, what));
    dispatch({ type: 'plan/patch', patch, reason: what, at: nowIso() });
  };

  const setTier = (category: Category, tier: Tier) => {
    const label = CATEGORY_LABELS[category];
    commit({ categoryTiers: { [category]: tier } }, `${label} style → ${TIER_LABELS[tier]}`);
  };

  const toggleProtect = (category: Category, isProtected: boolean) => {
    const protectedCategories = isProtected
      ? [...plan.profile.protectedCategories, category]
      : plan.profile.protectedCategories.filter((item) => item !== category);
    dispatch({
      type: 'plan/patch',
      patch: { protectedCategories },
      reason: `${isProtected ? 'Protected' : 'Unprotected'} ${CATEGORY_LABELS[category]}`,
      at: nowIso(),
    });
  };

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

        <TableScroll label="Budget lines">
          <table>
            <caption className="visually-hidden">
              Budget lines for {plan.profile.guests} guests. Estimates are planning assumptions;
              quotes are what vendors told you.
            </caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Style</th>
                <th scope="col">Basis</th>
                <th scope="col" className="t-right">
                  Amount
                </th>
                <th scope="col">Your priority</th>
                <th scope="col">Protect</th>
              </tr>
            </thead>
            <tbody>
              {budget.lines.map((line) => (
                <tr key={line.category}>
                  <th scope="row">
                    {line.label}
                    <div className="small muted">{line.assumption}</div>
                  </th>
                  <td>
                    <label className="visually-hidden" htmlFor={`tier-${line.category}`}>
                      Style for {line.label}
                    </label>
                    <select
                      id={`tier-${line.category}`}
                      className="select select--compact"
                      value={line.tier}
                      disabled={line.basis === 'quote' || line.rateIsCustom}
                      onChange={(event) => {
                        setTier(line.category, event.target.value as Tier);
                      }}
                    >
                      {TIERS.map((tier) => (
                        <option key={tier} value={tier}>
                          {TIER_LABELS[tier]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {line.basis === 'quote' ? (
                      <Badge tone="ok" icon="check">
                        Quote · {line.quoteLabel}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">
                        {line.rateIsCustom ? 'Your rate' : 'Estimate (assumption)'}
                      </Badge>
                    )}
                  </td>
                  <td className="t-right num">{formatInr(line.amount)}</td>
                  <td className="small">{PRIORITY_LABELS[line.priority]}</td>
                  <td>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={line.isProtected}
                        onChange={(event) => {
                          toggleProtect(line.category, event.target.checked);
                        }}
                      />
                      <span className="visually-hidden">Protect {line.label}</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={3}>
                  Subtotal
                </th>
                <td className="t-right num">{formatInr(budget.subtotal)}</td>
                <td colSpan={2} />
              </tr>
              <tr>
                <th scope="row" colSpan={3}>
                  <label htmlFor="buffer-select">Surprise buffer</label>{' '}
                  <select
                    id="buffer-select"
                    className="select select--compact"
                    value={budget.contingencyPct}
                    onChange={(event) => {
                      commit(
                        { contingencyPct: Number(event.target.value) },
                        `Surprise buffer → ${event.target.value}%`,
                      );
                    }}
                  >
                    {BUFFER_OPTIONS.map((pct) => (
                      <option key={pct} value={pct}>
                        {pct}%
                      </option>
                    ))}
                  </select>
                </th>
                <td className="t-right num">{formatInr(budget.contingency)}</td>
                <td colSpan={2} />
              </tr>
              <tr>
                <th scope="row" colSpan={3}>
                  Estimated total
                </th>
                <td className="t-right num">{formatInr(budget.total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </TableScroll>
      </section>

      <TradeoffPanel />

      <WhatIfForm key={`${String(plan.profile.guests)}-${String(plan.profile.budget)}`} />

      <AssumptionsPanel />
    </div>
  );
}

/** Try a different headcount or budget. Changes are applied with a ripple message and can be undone. */
function WhatIfForm() {
  const { plan, dispatch } = useOpenPlan();
  const notify = useNotify();
  const [guests, setGuests] = useState(String(plan.profile.guests));
  const [budgetText, setBudgetText] = useState(String(plan.profile.budget));
  const [errors, setErrors] = useState<{ guests?: string; budget?: string }>({});

  return (
    <section className="card card--flat" aria-labelledby="whatif-title">
      <h2 id="whatif-title">What if…?</h2>
      <p className="muted small">
        Try a different headcount or budget. Every change can be undone from History.
      </p>
      <form
        className="row whatif"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const nextGuests = parseGuests(guests);
          const nextBudget = parseInrAmount(budgetText);
          const nextErrors: typeof errors = {};
          if (
            nextGuests === null ||
            nextGuests < LIMITS.minGuests ||
            nextGuests > LIMITS.maxGuests
          ) {
            nextErrors.guests = `Enter ${LIMITS.minGuests}–${LIMITS.maxGuests.toLocaleString('en-IN')} guests.`;
          }
          if (
            nextBudget === null ||
            nextBudget < LIMITS.minBudget ||
            nextBudget > LIMITS.maxBudget
          ) {
            nextErrors.budget = 'Enter a budget such as “7.5 lakh”.';
          }
          setErrors(nextErrors);
          if (nextGuests === null || nextBudget === null || Object.keys(nextErrors).length > 0)
            return;
          const patch: ProfilePatch = {};
          const parts: string[] = [];
          if (nextGuests !== plan.profile.guests) {
            patch.guests = nextGuests;
            parts.push(`guests ${plan.profile.guests} → ${nextGuests}`);
          }
          if (nextBudget !== plan.profile.budget) {
            patch.budget = nextBudget;
            parts.push(`budget ${formatInr(plan.profile.budget)} → ${formatInr(nextBudget)}`);
          }
          if (parts.length === 0) {
            notify({ tone: 'info', text: 'Nothing changed.' });
            return;
          }
          const what = `What-if: ${parts.join(', ')}`;
          notify(rippleMessage(plan, patch, what));
          dispatch({ type: 'plan/patch', patch, reason: what, at: nowIso() });
        }}
      >
        <TextField
          label="Guests"
          inputMode="numeric"
          className="input--narrow"
          value={guests}
          error={errors.guests}
          onChange={(event) => {
            setGuests(event.target.value);
          }}
        />
        <TextField
          label="Budget"
          inputMode="decimal"
          className="input--narrow"
          value={budgetText}
          error={errors.budget}
          onChange={(event) => {
            setBudgetText(event.target.value);
          }}
        />
        <Button type="submit">Apply</Button>
      </form>
    </section>
  );
}
