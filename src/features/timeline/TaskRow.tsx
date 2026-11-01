import { Badge } from '../../components/Badge';
import { formatDate, relativeDays } from '../../core/dates';
import type { ScheduledTask } from '../../core/timeline';
import { useOpenPlan } from '../../state/PlanContext';
import { actions } from '../../state/store';
import { TaskActions } from './TaskActions';
import { STATE_LABEL } from './timelineLabels';

export interface TaskRowProps {
  task: ScheduledTask;
  all: readonly ScheduledTask[];
}

/** One task: tick it off, see when it is due and what it waits on, and delay it if needed. */
export function TaskRow({ task, all }: TaskRowProps) {
  const { dispatch } = useOpenPlan();
  const state = STATE_LABEL[task.state];
  const titleOf = (id: string) => all.find((item) => item.id === id)?.title ?? id;
  const checkboxId = `task-${task.id}`;

  return (
    <li className="task" data-state={task.state}>
      <div className="task__main">
        <input
          id={checkboxId}
          type="checkbox"
          className="task__check"
          checked={task.done}
          onChange={(event) => {
            dispatch(actions.setTaskDone(task.id, task.title, event.target.checked));
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
      {!task.done ? <TaskActions task={task} all={all} /> : null}
    </li>
  );
}
