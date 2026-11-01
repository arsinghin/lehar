import { useState } from 'react';

import { Button } from '../../components/Button';
import { ExternalLink } from '../../components/ExternalLink';
import { SelectField } from '../../components/Field';
import { useNotify } from '../../components/Notice';
import { googleCalendarUrl } from '../../core/calendar';
import { openDependentCount, type ScheduledTask } from '../../core/timeline';
import { plural } from '../../lib/util';
import { useOpenPlan } from '../../state/PlanContext';
import { actions } from '../../state/store';
import { DEFAULT_DELAY_DAYS, DELAY_OPTIONS } from './timelineLabels';

export interface TaskActionsProps {
  task: ScheduledTask;
  all: readonly ScheduledTask[];
}

/** Delay a task (every dependent task moves with it), clear the delay, or add it to Google Calendar. */
export function TaskActions({ task, all }: TaskActionsProps) {
  const { dispatch } = useOpenPlan();
  const notify = useNotify();
  const [delay, setDelay] = useState(DEFAULT_DELAY_DAYS);

  const applyDelay = (days: number) => {
    const ripple = openDependentCount(task.id, all);
    dispatch(actions.delayTask(task.id, task.title, days));
    notify(
      days === 0
        ? { tone: 'ok', text: `Delay cleared for “${task.title}”.` }
        : {
            tone: 'warn',
            text: `“${task.title}” delayed by ${String(days)} days. This ripples to ${plural(ripple, 'dependent task')}.`,
          },
    );
  };

  return (
    <div className="task__actions row">
      <SelectField
        label={`Delay “${task.title}” by`}
        hideLabel
        compact
        value={delay}
        options={DELAY_OPTIONS}
        onValueChange={setDelay}
      />
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
      <ExternalLink
        href={googleCalendarUrl({ title: task.title, date: task.due, description: task.detail })}
        label={`Google Calendar for ${task.title}`}
        icon="calendar"
      >
        Google Calendar
      </ExternalLink>
    </div>
  );
}
