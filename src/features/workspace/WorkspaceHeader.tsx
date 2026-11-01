import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EVENT_TYPE_LABELS } from '../../core/constants/enums';
import { formatDateLong } from '../../core/dates';
import { formatInr, formatNumber } from '../../core/money';
import { useOpenPlan } from '../../state/PlanContext';
import { BudgetStatusBadge } from '../shared/StatusBadges';
import { UndoRedoButtons } from '../shared/UndoRedoButtons';
import { PlanMenu } from './PlanMenu';

export interface WorkspaceHeaderProps {
  title: string;
  onSomethingChanged: () => void;
  onNewPlan: () => void;
}

/** The plan's name and key facts, with the actions that apply to the whole plan. */
export function WorkspaceHeader({ title, onSomethingChanged, onNewPlan }: WorkspaceHeaderProps) {
  const { plan, derived } = useOpenPlan();
  const { profile } = plan;
  return (
    <header className="ws-header card">
      <div className="ws-header__title">
        <p className="hero__eyebrow">
          {EVENT_TYPE_LABELS[profile.eventType]}
          {plan.isDemo ? (
            <>
              {' '}
              <Badge tone="info">Demo</Badge>
            </>
          ) : null}
        </p>
        <h1 className="ws-title">{title}</h1>
        <p className="muted">
          {formatDateLong(profile.eventDate)} · {derived.schedule.daysLeft} days to go ·{' '}
          {formatNumber(profile.guests)} guests · {formatInr(profile.budget)}{' '}
          <BudgetStatusBadge status={derived.budget.status} />
        </p>
      </div>
      <div className="ws-header__actions row">
        <Button variant="primary" icon="ripple" onClick={onSomethingChanged}>
          Something changed?
        </Button>
        <UndoRedoButtons />
        <PlanMenu title={title} onNewPlan={onNewPlan} />
      </div>
    </header>
  );
}
