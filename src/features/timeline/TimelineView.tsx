import { useState } from 'react';

import { Alert, Badge, type Tone } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useNotify } from '../../components/Notice';
import { googleCalendarUrl } from '../../core/calendar';
import { formatDate, relativeDays } from '../../core/dates';
import { displayTitle } from '../../core/profile';
import { downstreamOf, type ScheduledTask, type TaskState } from '../../core/timeline';
import { nowIso, useOpenPlan } from '../../state/PlanContext';
import { exportIcs } from './exportIcs';

const STATE_LABEL: Record<TaskState, { text: string; tone: Tone }> = {
  overdue: { text: 'Overdue', tone: 'danger' },
  ready: { text: 'Due soon', tone: 'warn' },
  blocked: { text: 'Waiting', tone: 'neutral' },
  upcoming: { text: 'Later', tone: 'info' },
  done: { text: 'Done', tone: 'ok' },
};

const GROUPS: { state: TaskState; title: string }[] = [
  { state: 'overdue', title: 'Overdue' },
  { state: 'ready', title: 'Due in the next 2 weeks' },
  { state: 'blocked', title: 'Waiting on earlier decisions' },
  { state: 'upcoming', title: 'Later' },
  { state: 'done', title: 'Done' },
];

const DELAY_OPTIONS = [3, 7, 14, 30] as const;

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

      {GROUPS.map((group) => {
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

function TaskRow({ task, all }: { task: ScheduledTask; all: readonly ScheduledTask[] }) {
  const { dispatch } = useOpenPlan();
  const notify = useNotify();
  const [delay, setDelay] = useState<number>(7);
  const state = STATE_LABEL[task.state];
  const titleOf = (id: string) => all.find((item) => item.id === id)?.title ?? id;
  const checkboxId = `task-${task.id}`;

  const applyDelay = (days: number) => {
    const ripple = downstreamOf(task.id, all).filter(
      (id) => !all.find((item) => item.id === id)?.done,
    ).length;
    dispatch({ type: 'task/delay', taskId: task.id, title: task.title, days, at: nowIso() });
    notify({
      tone: days === 0 ? 'ok' : 'warn',
      text:
        days === 0
          ? `Delay cleared for “${task.title}”.`
          : `“${task.title}” delayed by ${days} days. This ripples to ${ripple} dependent task${ripple === 1 ? '' : 's'}.`,
    });
  };

  return (
    <li className="task" data-state={task.state}>
      <div className="task__main">
        <input
          id={checkboxId}
          type="checkbox"
          className="task__check"
          checked={task.done}
          onChange={(event) => {
            dispatch({
              type: 'task/setDone',
              taskId: task.id,
              title: task.title,
              done: event.target.checked,
              at: nowIso(),
            });
          }}
        />
        <div>
          <label htmlFor={checkboxId} className="task__title">
            {task.title}
          </label>
          <p className="small muted">{task.detail}</p>
          <div className="row small">
            <Badge tone={state.tone}>{state.text}</Badge>
            {task.priority === 'critical' && !task.done ? (
              <Badge tone="danger">Critical</Badge>
            ) : null}
            <span className="num">
              Due {formatDate(task.due)} ({relativeDays(task.daysUntilDue)})
            </span>
            {task.slipDays > 0 ? <Badge tone="warn">Moved {task.slipDays} days later</Badge> : null}
            {task.squeezed ? <Badge tone="danger">No slack left</Badge> : null}
          </div>
          {task.blockedBy.length > 0 && !task.done ? (
            <p className="small">Waiting on: {task.blockedBy.map(titleOf).join(', ')}</p>
          ) : null}
        </div>
      </div>
      {!task.done ? (
        <div className="task__actions row">
          <label className="visually-hidden" htmlFor={`delay-${task.id}`}>
            Delay “{task.title}” by
          </label>
          <select
            id={`delay-${task.id}`}
            className="select select--compact"
            value={delay}
            onChange={(event) => {
              setDelay(Number(event.target.value));
            }}
          >
            {DELAY_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days} days
              </option>
            ))}
          </select>
          <Button
            aria-label={`Delay ${task.title}`}
            size="s"
            onClick={() => {
              applyDelay(delay);
            }}
          >
            Delay
          </Button>
          {task.delayDays > 0 ? (
            <Button
              aria-label={`Clear delay for ${task.title}`}
              size="s"
              variant="ghost"
              onClick={() => {
                applyDelay(0);
              }}
            >
              Clear delay
            </Button>
          ) : null}
          <a
            aria-label={`Google Calendar for ${task.title} (opens in a new tab)`}
            className="btn btn--ghost btn--s"
            href={googleCalendarUrl({
              title: task.title,
              date: task.due,
              description: task.detail,
            })}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="calendar" /> Google Calendar
          </a>
        </div>
      ) : null}
    </li>
  );
}
