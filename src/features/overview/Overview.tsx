import { Alert, Badge, BudgetStatusBadge } from '../../components/Badge';
import { BudgetBar } from '../../components/BudgetBar';
import { Button } from '../../components/Button';
import { formatDate, relativeDays } from '../../core/dates';
import { formatInr } from '../../core/money';
import { useOpenPlan } from '../../state/PlanContext';
import { TaskDoneButton } from '../timeline/TaskDoneButton';
import type { WorkspaceTab } from '../workspace/tabs';

export function Overview({
  onNavigate,
  onChangeTest,
}: {
  onNavigate: (tab: WorkspaceTab) => void;
  onChangeTest: () => void;
}) {
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
          <Button variant="primary" icon="ripple" onClick={onChangeTest}>
            Try a sample change
          </Button>
        </Alert>
      ) : null}

      <div className="grid">
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
            {budget.gap > 0
              ? `Over by ${formatInr(budget.gap)} (${Math.round(budget.gapRatio * 100)}%).`
              : `${formatInr(-budget.gap)} left, including a ${budget.contingencyPct}% surprise buffer of ${formatInr(budget.contingency)}.`}{' '}
            About {formatInr(budget.perGuest)} per guest.
          </p>
          <Button
            variant={budget.gap > 0 ? 'primary' : 'secondary'}
            onClick={() => {
              onNavigate('budget');
            }}
          >
            {budget.gap > 0 ? 'See trade-offs' : 'Open budget'}
          </Button>
        </section>

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
      </div>

      {schedule.compressed || schedule.counts.overdue > 0 || budget.warnings.length > 0 ? (
        <section aria-labelledby="ov-risks" className="stack">
          <h2 id="ov-risks">Things to watch</h2>
          {schedule.compressed ? (
            <Alert tone="warn" title="The timeline is compressed">
              <p>
                You have {schedule.planningDays} days of planning time; {schedule.idealLeadDays} is
                ideal for this kind of event. Lehar has tightened every deadline, so book the
                critical items first.
              </p>
            </Alert>
          ) : null}
          {schedule.counts.overdue > 0 ? (
            <Alert
              tone="danger"
              title={`${schedule.counts.overdue} task${schedule.counts.overdue === 1 ? ' is' : 's are'} overdue`}
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
      ) : null}

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
