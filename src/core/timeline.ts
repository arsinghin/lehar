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
import type { PlanState, TaskProgress } from './schemas.js';

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

/** How many dependencies each task waits on. Throws on a dependency that does not exist. */
function countDependencies(templates: readonly TaskTemplate[]): Map<string, number> {
  const ids = new Set(templates.map((task) => task.id));
  for (const task of templates) {
    const unknown = task.dependsOn.find((dep) => !ids.has(dep));
    if (unknown) throw new Error(`Task "${task.id}" depends on unknown task "${unknown}"`);
  }
  return new Map(templates.map((task) => [task.id, task.dependsOn.length]));
}

/** Kahn's algorithm. Throws on unknown dependencies or cycles, which are template bugs. */
export function topologicalOrder(templates: readonly TaskTemplate[]): TaskTemplate[] {
  const waiting = countDependencies(templates);
  const queue = templates.filter((task) => waiting.get(task.id) === 0);
  const order: TaskTemplate[] = [];
  for (let task = queue.shift(); task; task = queue.shift()) {
    order.push(task);
    const finished = task.id;
    for (const next of templates.filter((candidate) => candidate.dependsOn.includes(finished))) {
      const remaining = (waiting.get(next.id) ?? 0) - 1;
      waiting.set(next.id, remaining);
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

interface ScheduleContext {
  eventDate: IsoDate;
  today: IsoDate;
  /** Share of each ideal lead time that fits in the planning window (1 = no compression). */
  factor: number;
  progress: Readonly<Record<string, TaskProgress>>;
  scheduled: ReadonlyMap<string, ScheduledTask>;
  dependents: ReadonlyMap<string, string[]>;
}

/** The largest slip among unfinished upstream tasks, which this task inherits. */
function inheritedSlip(template: TaskTemplate, scheduled: ReadonlyMap<string, ScheduledTask>) {
  return Math.max(
    0,
    ...template.dependsOn.map((dep) => {
      const upstream = scheduled.get(dep);
      return upstream && !upstream.done ? upstream.slipDays : 0;
    }),
  );
}

/** Dates and state for one task. Its dependencies must already be in `context.scheduled`. */
function scheduleTask(template: TaskTemplate, context: ScheduleContext): ScheduledTask {
  const { eventDate, today, factor, scheduled } = context;
  const saved = context.progress[template.id];
  const done = saved?.done ?? false;
  const delayDays = done ? 0 : (saved?.delayDays ?? 0);
  const baseDue = addDays(eventDate, -Math.round(template.offsetDays * factor));
  const slipDays = done ? 0 : Math.max(delayDays, inheritedSlip(template, scheduled));
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
    dependents: context.dependents.get(template.id) ?? [],
    daysUntilDue: diffDays(due, today),
  };
  return { ...task, state: stateFor(task, today) };
}

function countByState(tasks: readonly ScheduledTask[]): Record<TaskState, number> {
  const counts: Record<TaskState, number> = {
    done: 0,
    overdue: 0,
    blocked: 0,
    ready: 0,
    upcoming: 0,
  };
  for (const task of tasks) counts[task.state] += 1;
  return counts;
}

/**
 * Back-schedules every task from the event date in dependency order. When there is less time than
 * ideal, every lead time shrinks in proportion; delays move a task and everything that depends on it.
 */
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
  const planningDays = Math.max(0, diffDays(eventDate, minDate(startDate, eventDate)));
  const factor = Math.min(1, planningDays / ideal);

  const dependents = new Map<string, string[]>(templates.map((task) => [task.id, []]));
  for (const task of templates) {
    for (const dep of task.dependsOn) dependents.get(dep)?.push(task.id);
  }
  const scheduled = new Map<string, ScheduledTask>();
  const context: ScheduleContext = { eventDate, today, factor, progress, scheduled, dependents };
  for (const template of templates) scheduled.set(template.id, scheduleTask(template, context));

  const tasks = [...scheduled.values()].sort(
    (a, b) => diffDays(a.due, b.due) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  );
  const counts = countByState(tasks);
  return {
    tasks,
    eventDate,
    daysLeft: diffDays(eventDate, today),
    idealLeadDays: ideal,
    planningDays,
    compressed: factor < 1,
    doNext: tasks
      .filter((task) => !task.done && task.blockedBy.length === 0)
      .slice(0, DO_NEXT_COUNT),
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

/** How many not-yet-done tasks move when `taskId` slips. */
export function openDependentCount(taskId: string, tasks: readonly ScheduledTask[]): number {
  const done = new Set(tasks.filter((task) => task.done).map((task) => task.id));
  return downstreamOf(taskId, tasks).filter((id) => !done.has(id)).length;
}

/** Keeps a requested delay between 0 and `maxDays` whole days. */
export function clampDelay(days: number, maxDays: number): number {
  return Math.min(Math.max(0, Math.round(days)), maxDays);
}

/** The schedule for a saved plan as of `today`. */
export function scheduleFor(plan: PlanState, today: IsoDate): Schedule {
  return buildSchedule({
    eventType: plan.profile.eventType,
    eventDate: plan.profile.eventDate,
    startDate: plan.startDate,
    progress: plan.progress,
    today,
  });
}
