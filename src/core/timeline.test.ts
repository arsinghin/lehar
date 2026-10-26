import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { TODAY } from '../../tests/fixtures';
import { EVENT_TYPES } from './constants/enums';
import { TASK_TEMPLATES, type TaskTemplate } from './constants/tasks';
import { addDays, diffDays } from './dates';
import {
  buildSchedule,
  clampDelay,
  downstreamOf,
  idealLeadDays,
  topologicalOrder,
} from './timeline';

const wedding = (overrides: Partial<Parameters<typeof buildSchedule>[0]> = {}) =>
  buildSchedule({
    eventType: 'wedding',
    eventDate: addDays(TODAY, 120),
    startDate: TODAY,
    progress: {},
    today: TODAY,
    ...overrides,
  });

describe('task templates', () => {
  it.each(EVENT_TYPES)('%s templates are acyclic and ordered sensibly', (eventType) => {
    const templates = TASK_TEMPLATES[eventType];
    expect(topologicalOrder(templates)).toHaveLength(templates.length);
    const byId = new Map(templates.map((t) => [t.id, t]));
    for (const task of templates) {
      for (const dep of task.dependsOn) {
        // A dependency must be due no later than the task that needs it.
        expect(byId.get(dep)?.offsetDays).toBeGreaterThanOrEqual(task.offsetDays);
      }
    }
  });

  it('rejects unknown dependencies and cycles', () => {
    const base: TaskTemplate = {
      id: 'a',
      title: 'A',
      detail: '',
      category: 'general',
      offsetDays: 1,
      dependsOn: ['x'],
      priority: 'normal',
    };
    expect(() => topologicalOrder([base])).toThrow(/unknown/);
    const cycle: TaskTemplate[] = [
      { ...base, id: 'a', dependsOn: ['b'] },
      { ...base, id: 'b', dependsOn: ['a'] },
    ];
    expect(() => topologicalOrder(cycle)).toThrow(/cycle/);
  });
});

describe('buildSchedule', () => {
  it('back-schedules from the event date with the ideal lead times', () => {
    const schedule = wedding();
    expect(schedule.compressed).toBe(false);
    expect(schedule.daysLeft).toBe(120);
    expect(schedule.tasks.find((t) => t.id === 'book-venue')?.due).toBe(addDays(TODAY, 20));
    expect(schedule.tasks.at(-1)?.id).toBe('day-kit');
  });

  it('compresses proportionally when there is less time than ideal', () => {
    const schedule = wedding({ eventDate: addDays(TODAY, 60) });
    expect(schedule.compressed).toBe(true);
    expect(schedule.planningDays).toBe(60);
    for (const task of schedule.tasks) expect(diffDays(task.due, TODAY)).toBeGreaterThanOrEqual(0);
    expect(schedule.tasks.find((t) => t.id === 'fix-date')?.due).toBe(TODAY);
  });

  it('marks tasks overdue as time passes', () => {
    const later = addDays(TODAY, 30);
    const schedule = wedding({ today: later });
    expect(schedule.tasks.find((t) => t.id === 'fix-date')?.state).toBe('overdue');
    expect(schedule.counts.overdue).toBeGreaterThan(0);
  });

  it('blocks tasks until their dependencies are done, and suggests what to do next', () => {
    const schedule = wedding();
    expect(schedule.tasks.find((t) => t.id === 'book-venue')?.state).toBe('blocked');
    // Every wedding decision hangs off the date, so it is the only thing to do first.
    expect(schedule.doNext.map((t) => t.id)).toEqual(['fix-date']);
    const progressed = wedding({
      progress: {
        'fix-date': { done: true, delayDays: 0 },
        'guest-draft': { done: true, delayDays: 0 },
      },
    });
    expect(progressed.doNext[0]?.id).toBe('book-venue');
    expect(progressed.progressPct).toBe(13);
    expect(progressed.tasks.find((t) => t.id === 'fix-date')?.state).toBe('done');
  });

  it('ripples a delay to every open downstream task', () => {
    const schedule = wedding({ progress: { 'book-venue': { done: false, delayDays: 10 } } });
    const venue = schedule.tasks.find((t) => t.id === 'book-venue');
    const caterer = schedule.tasks.find((t) => t.id === 'book-caterer');
    expect(venue?.slipDays).toBe(10);
    expect(caterer?.slipDays).toBe(10);
    expect(diffDays(caterer?.due ?? '', caterer?.baseDue ?? '')).toBe(10);
    expect(schedule.tasks.find((t) => t.id === 'book-photo')?.slipDays).toBe(0);
  });

  it('does not ripple delays from completed work', () => {
    const schedule = wedding({ progress: { 'book-venue': { done: true, delayDays: 10 } } });
    expect(schedule.tasks.find((t) => t.id === 'book-caterer')?.slipDays).toBe(0);
  });

  it('squeezes tasks against the event date when slack runs out', () => {
    const schedule = wedding({ progress: { 'run-sheet': { done: false, delayDays: 30 } } });
    const kit = schedule.tasks.find((t) => t.id === 'day-kit');
    expect(kit?.due).toBe(schedule.eventDate);
    expect(kit?.squeezed).toBe(true);
  });

  it('handles an event today and a start date after the event', () => {
    const schedule = wedding({ eventDate: TODAY, startDate: addDays(TODAY, 5) });
    expect(schedule.daysLeft).toBe(0);
    for (const task of schedule.tasks) expect(task.due).toBe(TODAY);
  });

  it.each(EVENT_TYPES)('every %s task gets a due date on or before the event', (eventType) => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 400 }), (days) => {
        const eventDate = addDays(TODAY, days);
        const schedule = buildSchedule({
          eventType,
          eventDate,
          startDate: TODAY,
          progress: {},
          today: TODAY,
        });
        for (const task of schedule.tasks) {
          expect(diffDays(eventDate, task.due)).toBeGreaterThanOrEqual(0);
          for (const dep of task.dependsOn) {
            const upstream = schedule.tasks.find((t) => t.id === dep);
            expect(diffDays(task.due, upstream?.due ?? '')).toBeGreaterThanOrEqual(0);
          }
        }
      }),
      { numRuns: 40 },
    );
  });
});

describe('helpers', () => {
  it('lists the downstream ripple of a task', () => {
    const downstream = downstreamOf('book-venue', wedding().tasks);
    expect(downstream).toEqual(
      expect.arrayContaining(['book-caterer', 'menu-final', 'run-sheet', 'day-kit']),
    );
    expect(downstream).not.toContain('book-photo');
    expect(downstreamOf('missing', wedding().tasks)).toEqual([]);
  });

  it('knows the ideal lead time per event type', () => {
    expect(idealLeadDays('wedding')).toBe(120);
    expect(idealLeadDays('birthday')).toBe(30);
    expect(idealLeadDays('community')).toBe(60);
  });

  it('clamps delays', () => {
    expect(clampDelay(-3, 30)).toBe(0);
    expect(clampDelay(45, 30)).toBe(30);
    expect(clampDelay(7.4, 30)).toBe(7);
  });
});
