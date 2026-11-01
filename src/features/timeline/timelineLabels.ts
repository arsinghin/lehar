import type { Tone } from '../../components/Badge';
import type { TaskState } from '../../core/timeline';

export const STATE_LABEL: Record<TaskState, { text: string; tone: Tone }> = {
  overdue: { text: 'Overdue', tone: 'danger' },
  ready: { text: 'Due soon', tone: 'warn' },
  blocked: { text: 'Waiting', tone: 'neutral' },
  upcoming: { text: 'Later', tone: 'info' },
  done: { text: 'Done', tone: 'ok' },
};

/** The order and headings of the task groups on the Timeline tab. */
export const TASK_GROUPS: readonly { state: TaskState; title: string }[] = [
  { state: 'overdue', title: 'Overdue' },
  { state: 'ready', title: 'Due in the next 2 weeks' },
  { state: 'blocked', title: 'Waiting on earlier decisions' },
  { state: 'upcoming', title: 'Later' },
  { state: 'done', title: 'Done' },
];

/** Delays the host can pick; the second is preselected. */
export const DELAY_OPTIONS = [3, 7, 14, 30].map((days) => ({
  value: days,
  label: `${String(days)} days`,
}));
export const DEFAULT_DELAY_DAYS = 7;
