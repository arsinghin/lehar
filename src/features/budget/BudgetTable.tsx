import { Badge } from '../../components/Badge';
import { SelectField } from '../../components/Field';
import { useNotify } from '../../components/Notice';
import { TableScroll } from '../../components/TableScroll';
import type { BudgetLine } from '../../core/budget';
import { CATEGORY_LABELS, PRIORITY_LABELS, TIER_LABELS, TIERS } from '../../core/constants/enums';
import { formatInr, formatNumber } from '../../core/money';
import { toggleItem } from '../../lib/util';
import { useOpenPlan } from '../../state/PlanContext';
import { actions } from '../../state/store';
import { useRipplePatch } from './useRipplePatch';

const TIER_OPTIONS = TIERS.map((tier) => ({ value: tier, label: TIER_LABELS[tier] }));
const BUFFER_OPTIONS = [0, 5, 10, 15, 20].map((pct) => ({ value: pct, label: `${String(pct)}%` }));

/** Every budget line with its style, basis and priority, plus the buffer and the totals. */
export function BudgetTable() {
  const { plan, derived } = useOpenPlan();
  const patchWithRipple = useRipplePatch();
  const { budget } = derived;

  return (
    <TableScroll label="Budget lines">
      <table>
        <caption className="visually-hidden">
          Budget lines for {formatNumber(plan.profile.guests)} guests. Estimates are planning
          assumptions; quotes are what vendors told you.
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
            <BudgetLineRow key={line.category} line={line} />
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
              <SelectField
                label="Surprise buffer"
                className="field--inline"
                compact
                value={budget.contingencyPct}
                options={BUFFER_OPTIONS}
                onValueChange={(pct) => {
                  patchWithRipple({ contingencyPct: pct }, `Surprise buffer → ${String(pct)}%`);
                }}
              />
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
  );
}

function BudgetLineRow({ line }: { line: BudgetLine }) {
  const { plan, dispatch } = useOpenPlan();
  const notify = useNotify();
  const patchWithRipple = useRipplePatch();
  const label = CATEGORY_LABELS[line.category];

  const toggleProtect = (isProtected: boolean) => {
    const protectedCategories = toggleItem(
      plan.profile.protectedCategories,
      line.category,
      isProtected,
    );
    dispatch(
      actions.patchPlan(
        { protectedCategories },
        `${isProtected ? 'Protected' : 'Unprotected'} ${label}`,
      ),
    );
    notify({
      tone: 'info',
      text: isProtected
        ? `${label} is protected: trade-offs will leave it alone.`
        : `${label} is no longer protected.`,
    });
  };

  return (
    <tr>
      <th scope="row">
        {line.label}
        <div className="small muted">{line.assumption}</div>
      </th>
      <td>
        <SelectField
          label={`Style for ${line.label}`}
          hideLabel
          compact
          value={line.tier}
          options={TIER_OPTIONS}
          disabled={line.basis === 'quote' || line.rateIsCustom}
          onValueChange={(tier) => {
            patchWithRipple(
              { categoryTiers: { [line.category]: tier } },
              `${label} style → ${TIER_LABELS[tier]}`,
            );
          }}
        />
      </td>
      <td>
        {line.basis === 'quote' ? (
          <Badge tone="ok" icon="check">
            Quote · {line.quoteLabel}
          </Badge>
        ) : (
          <Badge tone="neutral">{line.rateIsCustom ? 'Your rate' : 'Estimate (assumption)'}</Badge>
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
              toggleProtect(event.target.checked);
            }}
          />
          <span className="visually-hidden">Protect {line.label}</span>
        </label>
      </td>
    </tr>
  );
}
