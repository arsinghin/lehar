/**
 * Timeline engine: schedules tasks backwards from the event date, respecting dependencies.
 *
 * - Ideal lead times are compressed proportionally when the planning window is shorter than ideal.
 *   The window is measured from the plan's start date, so tasks can genuinely become overdue.
 * - A delay on one task ripples to everything that depends on it (unless that work is done).
 * - "Do next" = unblocked open tasks, earliest due first, then by priority.
 */
import { TASK_TEMPLATES, type TaskPriority, type TaskTemplate } from './constants/tasks.js';
import { addDays, diffDays, minDate, type IsoDate } from './dates.js';
import type { EventType } from './constants/enums.js';
import type { TaskProgress } from './schemas.js';

export type TaskState = 'done' | 'overdue' | 'blocked' | 'ready' | 'upcoming';

export interface ScheduledTask extends TaskTemplate {
  baseDue: IsoDate;
  due: IsoDate;
  done: boolean;
  delayDays: number;
  /** Days this task slipped because of its own delay or an upstream delay. */
  slipDays: number;
  /** Pushed to the event date itself because there is no slack left. */
  squeezed: boolean;
  state: TaskState;
  blockedBy: string[];
  dependents: string[];
  daysUntilDue: number;
}

export interface Schedule {
  tasks: ScheduledTask[];
  eventDate: IsoDate;
  daysLeft: number;
  idealLeadDays: number;
  planningDays: number;
  compressed: boolean;
  doNext: ScheduledTask[];
  counts: Record<TaskState, number>;
  progressPct: number;
}

const PRIORITY_RANK: Record<TaskPriority, number> = { critical: 0, high: 1, normal: 2 };
/** Tasks due within this many days are "ready" rather than "upcoming". */
export const READY_WINDOW_DAYS = 14;
export const DO_NEXT_COUNT = 3;

/** Kahn's algorithm. Throws on unknown dependencies or cycles, which are template bugs. */
export function topologicalOrder(templates: readonly TaskTemplate[]): TaskTemplate[] {
  const byId = new Map(templates.map((task) => [task.id, task]));
  const indegree = new Map(templates.map((task) => [task.id, 0]));
  for (const task of templates) {
    for (const dep of task.dependsOn) {
      if (!byId.has(dep)) throw new Error(`Task "${task.id}" depends on unknown task "${dep}"`);
      indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1);
    }
  }
  const queue = templates.filter((task) => indegree.get(task.id) === 0);
  const order: TaskTemplate[] = [];
  while (queue.length > 0) {
    const task = queue.shift();
    if (!task) break;
    order.push(task);
    for (const next of templates) {
      if (!next.dependsOn.includes(task.id)) continue;
      const remaining = (indegree.get(next.id) ?? 0) - 1;
      indegree.set(next.id, remaining);
      if (remaining === 0) queue.push(next);
    }
  }
  if (order.length !== templates.length) throw new Error('Task dependencies contain a cycle');
  return order;
}

/** Ideal planning window for an event type (its longest lead time). */
export function idealLeadDays(eventType: EventType): number {
  return Math.max(...TASK_TEMPLATES[eventType].map((task) => task.offsetDays));
}

function stateFor(
  task: { done: boolean; due: IsoDate; blockedBy: string[] },
  today: IsoDate,
): TaskState {
  if (task.done) return 'done';
  if (diffDays(task.due, today) < 0) return 'overdue';
  if (task.blockedBy.length > 0) return 'blocked';
  return diffDays(task.due, today) <= READY_WINDOW_DAYS ? 'ready' : 'upcoming';
}

export interface ScheduleInput {
  eventType: EventType;
  eventDate: IsoDate;
  startDate: IsoDate;
  progress: Readonly<Record<string, TaskProgress>>;
  today: IsoDate;
}

export function buildSchedule({
  eventType,
  eventDate,
  startDate,
  progress,
  today,
}: ScheduleInput): Schedule {
  const templates = topologicalOrder(TASK_TEMPLATES[eventType]);
  const ideal = idealLeadDays(eventType);
  // The window cannot start after the event, and an event that moved earlier shrinks the window.
  const start = minDate(startDate, eventDate);
  const planningDays = Math.max(0, diffDays(eventDate, start));
  const factor = Math.min(1, planningDays / ideal);

  const scheduled = new Map<string, ScheduledTask>();
  const dependents = new Map<string, string[]>(templates.map((task) => [task.id, []]));
  for (const task of templates)
    for (const dep of task.dependsOn) dependents.get(dep)?.push(task.id);

  for (const template of templates) {
    const state = progress[template.id];
    const done = state?.done ?? false;
    const delayDays = done ? 0 : (state?.delayDays ?? 0);
    const baseDue = addDays(eventDate, -Math.round(template.offsetDays * factor));
    const inheritedSlip = Math.max(
      0,
      ...template.dependsOn.map((dep) => {
        const upstream = scheduled.get(dep);
        return upstream && !upstream.done ? upstream.slipDays : 0;
      }),
    );
    const slipDays = done ? 0 : Math.max(delayDays, inheritedSlip);
    const unclamped = addDays(baseDue, slipDays);
    const due = minDate(unclamped, eventDate);
    const blockedBy = template.dependsOn.filter((dep) => !(scheduled.get(dep)?.done ?? false));
    const task: ScheduledTask = {
      ...template,
      baseDue,
      due,
      done,
      delayDays,
      slipDays,
      squeezed: !done && diffDays(unclamped, eventDate) >= 0 && slipDays > 0,
      state: 'upcoming',
      blockedBy,
      dependents: dependents.get(template.id) ?? [],
      daysUntilDue: diffDays(due, today),
    };
    task.state = stateFor(task, today);
    scheduled.set(template.id, task);
  }

  const tasks = [...scheduled.values()].sort(
    (a, b) => diffDays(a.due, b.due) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  );
  const counts: Record<TaskState, number> = {
    done: 0,
    overdue: 0,
    blocked: 0,
    ready: 0,
    upcoming: 0,
  };
  for (const task of tasks) counts[task.state] += 1;
  const doNext = tasks
    .filter((task) => !task.done && task.blockedBy.length === 0)
    .slice(0, DO_NEXT_COUNT);

  return {
    tasks,
    eventDate,
    daysLeft: diffDays(eventDate, today),
    idealLeadDays: ideal,
    planningDays,
    compressed: factor < 1,
    doNext,
    counts,
    progressPct: Math.round((counts.done / tasks.length) * 100),
  };
}

/** Ids of every task downstream of `taskId` (the ripple of a delay). */
export function downstreamOf(taskId: string, tasks: readonly ScheduledTask[]): string[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const seen = new Set<string>();
  const stack = [...(byId.get(taskId)?.dependents ?? [])];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    stack.push(...(byId.get(id)?.dependents ?? []));
  }
  return [...seen];
}

/** Clamp helper used by the UI when the host picks a delay. */
export function clampDelay(days: number, maxDays: number): number {
  return Math.min(Math.max(0, Math.round(days)), maxDays);
}
