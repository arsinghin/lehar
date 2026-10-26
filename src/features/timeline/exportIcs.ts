import { buildIcs, icsStamp } from '../../core/calendar';
import type { ScheduledTask } from '../../core/timeline';
import { downloadText, slugify } from '../../lib/util';

/** Downloads the event day plus every open task as all-day calendar entries. */
export function exportIcs(title: string, eventDate: string, tasks: readonly ScheduledTask[]): void {
  const items = [
    {
      uid: 'event',
      title,
      date: eventDate,
      description: 'The celebration day, planned with Lehar.',
    },
    ...tasks
      .filter((task) => !task.done)
      .map((task) => ({
        uid: task.id,
        title: `${task.title} (Lehar)`,
        date: task.due,
        description: task.detail,
      })),
  ];
  downloadText(`${slugify(title)}.ics`, buildIcs(items, icsStamp(new Date())), 'text/calendar');
}
