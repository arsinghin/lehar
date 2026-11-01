import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { BudgetBar } from '../../components/BudgetBar';
import { Button } from '../../components/Button';
import type { BudgetSummary } from '../../core/budget';
import { formatDate, relativeDays } from '../../core/dates';
import { formatInr } from '../../core/money';
import type { Schedule } from '../../core/timeline';
import { plural } from '../../lib/util';
import { useOpenPlan } from '../../state/PlanContext';
import { BudgetStatusBadge } from '../shared/StatusBadges';
import { TaskDoneButton } from '../timeline/TaskDoneButton';
import type { WorkspaceTab } from '../workspace/tabs';

export interface OverviewProps {
  onNavigate: (tab: WorkspaceTab) => void;
  onSampleChange: () => void;
}

/** The plan at a glance: budget health, what to do next, risks, and ideas. */
export function Overview({ onNavigate, onSampleChange }: OverviewProps) {
  const { plan, derived } = useOpenPlan();
  const { budget, schedule } = derived;

  return (
    <div className="stack-l">
      {plan.isDemo ? (
        <Alert tone="info" title="This is a demo plan with sample data">
          <p>
            Try a sample change: 50 more guests, a 10% smaller budget and the event 2 weeks earlier.
            You will see every ripple before anything changes.
          </p>
          <Button variant="primary" icon="ripple" onClick={onSampleChange}>
            Try a sample change
          </Button>
        </Alert>
      ) : null}
      <div className="grid">
        <BudgetHealth budget={budget} onNavigate={onNavigate} />
        <DoNext schedule={schedule} onNavigate={onNavigate} />
      </div>
      <ThingsToWatch budget={budget} schedule={schedule} />
      <section className="card card--flat" aria-labelledby="ov-ideas">
        <h2 id="ov-ideas">Ideas for your guests</h2>
        {plan.ideas ? (
          <ul>
            {plan.ideas.items.map((idea) => (
              <li key={idea.title}>{idea.title}</li>
            ))}
          </ul>
        ) : (
          <p>
            Get three concepts that fit your guests, culture and budget, then refine them in plain
            words.
          </p>
        )}
        <Button
          onClick={() => {
            onNavigate('ideas');
          }}
        >
          {plan.ideas ? 'Open ideas' : 'Get ideas'}
        </Button>
      </section>
    </div>
  );
}

interface CardProps {
  onNavigate: (tab: WorkspaceTab) => void;
}

function BudgetHealth({ budget, onNavigate }: CardProps & { budget: BudgetSummary }) {
  const over = budget.gap > 0;
  return (
    <section className="card" aria-labelledby="ov-budget">
      <div className="card__title">
        <h2 id="ov-budget">Budget health</h2>
        <BudgetStatusBadge status={budget.status} />
      </div>
      <p className="big-number">
        <span className="num">{formatInr(budget.total)}</span>{' '}
        <span className="muted small">estimated, of {formatInr(budget.budget)}</span>
      </p>
      <BudgetBar
        total={budget.total}
        budget={budget.budget}
        status={budget.status}
        label={`Estimated ${formatInr(budget.total)} against a budget of ${formatInr(budget.budget)}`}
      />
      <p className="small">
        {over
          ? `Over by ${formatInr(budget.gap)} (${String(Math.round(budget.gapRatio * 100))}%).`
          : `${formatInr(-budget.gap)} left, including a ${String(budget.contingencyPct)}% surprise buffer of ${formatInr(budget.contingency)}.`}{' '}
        About {formatInr(budget.perGuest)} per guest.
      </p>
      <Button
        variant={over ? 'primary' : 'secondary'}
        onClick={() => {
          onNavigate('budget');
        }}
      >
        {over ? 'See trade-offs' : 'Open budget'}
      </Button>
    </section>
  );
}

function DoNext({ schedule, onNavigate }: CardProps & { schedule: Schedule }) {
  return (
    <section className="card" aria-labelledby="ov-next">
      <div className="card__title">
        <h2 id="ov-next">Do next</h2>
        <span className="muted small">{schedule.daysLeft} days to go</span>
      </div>
      {schedule.doNext.length === 0 ? (
        <p>Everything is done. Enjoy the celebration!</p>
      ) : (
        <ol className="task-mini">
          {schedule.doNext.map((task) => (
            <li key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <div className="small muted">
                  Due {formatDate(task.due)} · {relativeDays(task.daysUntilDue)}{' '}
                  {task.state === 'overdue' ? <Badge tone="danger">Overdue</Badge> : null}
                </div>
              </div>
              <TaskDoneButton task={task} />
            </li>
          ))}
        </ol>
      )}
      <label className="small" htmlFor="ov-progress">
        {schedule.counts.done} of {schedule.tasks.length} tasks done
      </label>
      <progress id="ov-progress" max={schedule.tasks.length} value={schedule.counts.done} />
      <Button
        onClick={() => {
          onNavigate('timeline');
        }}
      >
        Open timeline
      </Button>
    </section>
  );
}

function ThingsToWatch({ budget, schedule }: { budget: BudgetSummary; schedule: Schedule }) {
  const overdue = schedule.counts.overdue;
  if (!schedule.compressed && overdue === 0 && budget.warnings.length === 0) return null;
  return (
    <section aria-labelledby="ov-risks" className="stack">
      <h2 id="ov-risks">Things to watch</h2>
      {schedule.compressed ? (
        <Alert tone="warn" title="The timeline is compressed">
          <p>
            You have {schedule.planningDays} days of planning time; {schedule.idealLeadDays} is
            ideal for this kind of event. Lehar has tightened every deadline, so book the critical
            items first.
          </p>
        </Alert>
      ) : null}
      {overdue > 0 ? (
        <Alert
          tone="danger"
          title={`${plural(overdue, 'task')} ${overdue === 1 ? 'is' : 'are'} overdue`}
        >
          <p>Open the timeline to catch up, or delay them to see what else moves.</p>
        </Alert>
      ) : null}
      {budget.warnings.map((warning) => (
        <Alert key={`${warning.code}-${warning.category ?? ''}`} tone="warn">
          <p>{warning.message}</p>
        </Alert>
      ))}
    </section>
  );
}
