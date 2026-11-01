/**
 * Budget vs plan bar drawn in SVG. Widths are attributes rather than inline styles, so the
 * strict CSP (no 'unsafe-inline') holds. The numbers are always given in text as well.
 */
import type { BudgetStatus } from '../core/budget';

/** A bar showing the estimate against the budget, with the same facts in its accessible label. */
export function BudgetBar({
  total,
  budget,
  status,
  label,
}: {
  total: number;
  budget: number;
  status: BudgetStatus;
  label: string;
}) {
  const scale = Math.max(total, budget, 1);
  const fill = Math.min(100, (total / scale) * 100);
  const limit = Math.min(100, (budget / scale) * 100);
  return (
    <svg
      className="budget-bar"
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <rect className="budget-bar__track" x="0" y="0" width="100" height="10" rx="2" />
      <rect className={`budget-bar__fill--${status}`} x="0" y="0" width={fill} height="10" rx="2" />
      <line
        className="budget-bar__limit"
        x1={limit}
        x2={limit}
        y1="0"
        y2="10"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
