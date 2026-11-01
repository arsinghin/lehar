import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { formatDate } from '../../core/dates';
import { displayTitle } from '../../core/profile';
import { useOpenPlan } from '../../state/PlanContext';
import { exportIcs } from './exportIcs';
import { TaskRow } from './TaskRow';
import { TASK_GROUPS } from './timelineLabels';

/** Every task, grouped by urgency, with progress and a whole-plan calendar export. */
export function TimelineView() {
  const { plan, derived } = useOpenPlan();
  const { schedule } = derived;
  const title = displayTitle(plan.profile);

  return (
    <div className="stack-l">
      <section className="stack" aria-labelledby="timeline-title">
        <div className="card__title">
          <h2 id="timeline-title">Timeline</h2>
          <Button
            icon="download"
            onClick={() => {
              exportIcs(title, plan.profile.eventDate, schedule.tasks);
            }}
          >
            Add all to my calendar (.ics)
          </Button>
        </div>
        <p className="muted">
          {schedule.daysLeft} days to {formatDate(schedule.eventDate)}. Tasks are scheduled
          backwards from your date, in the order decisions depend on each other. Delay one and Lehar
          moves everything that depends on it.
        </p>
        {schedule.compressed ? (
          <Alert tone="warn" title="Short on time">
            <p>
              Ideal planning time is {schedule.idealLeadDays} days; you have {schedule.planningDays}
              . Deadlines have been compressed proportionally. Start with the critical tasks.
            </p>
          </Alert>
        ) : null}
        <label htmlFor="tl-progress" className="small">
          {schedule.progressPct}% done ({schedule.counts.done} of {schedule.tasks.length})
        </label>
        <progress id="tl-progress" max={100} value={schedule.progressPct} />
      </section>

      {TASK_GROUPS.map((group) => {
        const tasks = schedule.tasks.filter((task) => task.state === group.state);
        if (tasks.length === 0) return null;
        return (
          <section key={group.state} aria-labelledby={`group-${group.state}`}>
            <h3 id={`group-${group.state}`}>
              {group.title} <span className="muted small">({tasks.length})</span>
            </h3>
            <ul className="task-list">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} all={schedule.tasks} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
