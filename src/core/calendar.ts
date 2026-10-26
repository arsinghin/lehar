/**
 * Calendar export (RFC 5545 .ics) and keyless Google Calendar / Google Maps links.
 * Links are plain navigations, so no API key, script or tracking is involved.
 */
import { addDays, type IsoDate } from './dates.js';

export interface CalendarItem {
  uid: string;
  title: string;
  date: IsoDate;
  description: string;
}

const compact = (iso: IsoDate) => iso.replace(/-/g, '');

/** Escapes text per RFC 5545 §3.3.11. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Folds content lines longer than 75 octets (RFC 5545 §3.1). */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (encoder.encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else current += char;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** An all-day event per item. `stamp` is an ICS UTC timestamp, injected for deterministic tests. */
export function buildIcs(items: readonly CalendarItem[], stamp: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lehar//Event Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const item of items) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${item.uid}@lehar`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(item.date)}`,
      `DTEND;VALUE=DATE:${compact(addDays(item.date, 1))}`,
      `SUMMARY:${escapeIcsText(item.title)}`,
      `DESCRIPTION:${escapeIcsText(item.description)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/** Formats a Date as an ICS UTC timestamp (YYYYMMDDTHHMMSSZ). */
export function icsStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Opens Google Calendar's "create event" screen prefilled with an all-day event. */
export function googleCalendarUrl(item: Omit<CalendarItem, 'uid'>): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: item.title,
    dates: `${compact(item.date)}/${compact(addDays(item.date, 1))}`,
    details: item.description,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Google Maps search, e.g. "caterers near Pune". The results are unverified by Lehar. */
export function googleMapsSearchUrl(query: string, city: string): string {
  const q = city.trim() ? `${query} near ${city.trim()}` : query;
  const params = new URLSearchParams({ api: '1', query: q });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}
