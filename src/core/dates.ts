/**
 * Calendar-day arithmetic on ISO `YYYY-MM-DD` strings.
 * Everything is done in UTC day numbers so time zones and DST can never shift a date.
 */

export type IsoDate = string;

const MS_PER_DAY = 86_400_000;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const DISPLAY_FORMAT = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const DISPLAY_FORMAT_LONG = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** True for real calendar dates only (rejects 2027-02-30). */
export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Days since 1970-01-01 (UTC). Throws on invalid input so bugs surface early. */
export function toDayNumber(iso: IsoDate): number {
  if (!isValidIsoDate(iso)) throw new RangeError(`Invalid ISO date: ${iso}`);
  return (
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) /
    MS_PER_DAY
  );
}

export function fromDayNumber(dayNumber: number): IsoDate {
  return new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(iso) + Math.trunc(days));
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(to: IsoDate, from: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** The user's local calendar date. */
export function todayIso(now: Date = new Date()): IsoDate {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function formatDate(iso: IsoDate): string {
  return DISPLAY_FORMAT.format(new Date(toDayNumber(iso) * MS_PER_DAY));
}

export function formatDateLong(iso: IsoDate): string {
  return DISPLAY_FORMAT_LONG.format(new Date(toDayNumber(iso) * MS_PER_DAY));
}

/** 1–12 */
export function monthOf(iso: IsoDate): number {
  return Number(iso.slice(5, 7));
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return toDayNumber(a) <= toDayNumber(b) ? a : b;
}

/** Builds an ISO date from parts, or null when the parts are not a real date. */
export function isoFromParts(year: number, month: number, day: number): IsoDate | null {
  const iso = `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
  return isValidIsoDate(iso) ? iso : null;
}

/** Human phrase for a distance in days, e.g. "in 3 days", "today", "5 days ago". */
export function relativeDays(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}
