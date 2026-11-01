import { describe, expect, it } from 'vitest';

import {
  buildIcs,
  escapeIcsText,
  foldIcsLine,
  googleCalendarUrl,
  googleMapsSearchUrl,
  icsStamp,
} from './calendar';

describe('calendar exports', () => {
  it('builds a valid all-day ICS with escaped, folded text', () => {
    const ics = buildIcs(
      [
        {
          uid: 'book-venue',
          title: 'Book venue; confirm, today',
          date: '2026-11-15',
          description: 'Line 1\nLine 2 ' + 'x'.repeat(100),
        },
      ],
      '20261026T100000Z',
    );
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261115');
    expect(ics).toContain('DTEND;VALUE=DATE:20261116');
    expect(ics).toContain('SUMMARY:Book venue\\; confirm\\, today');
    for (const line of ics.split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('escapes and folds per RFC 5545', () => {
    expect(escapeIcsText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
    expect(foldIcsLine('short')).toBe('short');
    expect(foldIcsLine('é'.repeat(60)).split('\r\n ').length).toBe(2);
    expect(icsStamp(new Date('2026-10-26T10:00:00.123Z'))).toBe('20261026T100000Z');
  });

  it('builds keyless Google Calendar and Maps links', () => {
    const url = new URL(
      googleCalendarUrl({ title: 'Book venue', date: '2026-11-15', description: 'From Lehar' }),
    );
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('dates')).toBe('20261115/20261116');
    const maps = new URL(googleMapsSearchUrl('caterers', ' Pune '));
    expect(maps.searchParams.get('query')).toBe('caterers near Pune');
    expect(new URL(googleMapsSearchUrl('caterers', '')).searchParams.get('query')).toBe('caterers');
  });
});
