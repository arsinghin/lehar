import { Alert } from '../../../components/Alert';
import { estimateBudget } from '../../../core/budget';
import { CATEGORY_LABELS, EVENT_TYPE_LABELS, TIER_LABELS } from '../../../core/constants/enums';
import { formatDateLong } from '../../../core/dates';
import { formatInr, formatNumber } from '../../../core/money';
import type { EventProfile } from '../../../core/schemas';
import { BudgetStatusBadge } from '../../shared/StatusBadges';

/** Step 5: everything entered, with a first estimate before the plan is created. */
export function ReviewStep({ profile }: { profile: EventProfile | null }) {
  const preview = profile ? estimateBudget(profile) : null;
  return profile && preview ? (
    <>
      <dl className="summary-list">
        <div>
          <dt>Occasion</dt>
          <dd>{EVENT_TYPE_LABELS[profile.eventType]}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{formatDateLong(profile.eventDate)}</dd>
        </div>
        <div>
          <dt>Guests</dt>
          <dd>{formatNumber(profile.guests)}</dd>
        </div>
        <div>
          <dt>Budget</dt>
          <dd>{formatInr(profile.budget)}</dd>
        </div>
        <div>
          <dt>Style</dt>
          <dd>{TIER_LABELS[profile.tier]}</dd>
        </div>
        <div>
          <dt>Protected</dt>
          <dd>
            {profile.protectedCategories.map((c) => CATEGORY_LABELS[c]).join(', ') || 'Nothing yet'}
          </dd>
        </div>
      </dl>
      <Alert tone={preview.status === 'over' ? 'warn' : 'ok'} title="First estimate">
        <p>
          Based on Lehar’s planning assumptions, this kind of event costs about{' '}
          <strong>{formatInr(preview.total)}</strong> including a {preview.contingencyPct}
          % buffer. <BudgetStatusBadge status={preview.status} />
        </p>
        <p className="small">
          These are estimates, not quotes. You can change every assumption in the plan.
        </p>
      </Alert>
    </>
  ) : (
    <Alert tone="danger" title="Something is missing">
      <p>Please go back and check the earlier steps.</p>
    </Alert>
  );
}
