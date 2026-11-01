/** Absolute dates in the formats Indian hosts type: 2027-03-12, 12/03/2027 (day first), 12 March. */
import { diffDays, isoFromParts, type IsoDate } from '../dates.js';

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const MONTH_RE = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;

/** "12/3/27" means 2027. */
const TWO_DIGIT_YEAR_BASE = 2000;

function inferYear(month: number, day: number, today: IsoDate): IsoDate | null {
  const year = Number(today.slice(0, 4));
  const thisYear = isoFromParts(year, month, day);
  if (thisYear && diffDays(thisYear, today) >= 0) return thisYear;
  return isoFromParts(year + 1, month, day);
}

const monthIndex = (name: string) =>
  MONTHS.findIndex((month) => month.startsWith(name.slice(0, 3))) + 1;

/** A day and month with an optional year; without a year, the next time that date comes round. */
function dayMonth(day: number, month: number, year: string | undefined, today: IsoDate) {
  return year ? isoFromParts(Number(year), month, day) : inferYear(month, day, today);
}

type DateParser = (clause: string, today: IsoDate) => IsoDate | null | undefined;

/** Each parser returns undefined when its format is absent, so the next one is tried. */
const DATE_PARSERS: readonly DateParser[] = [
  // 2027-03-12
  (clause) => {
    const m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(clause);
    return m ? isoFromParts(Number(m[1]), Number(m[2]), Number(m[3])) : undefined;
  },
  // 12/03/2027, 12-3-27, 5/1 (day first, Indian style)
  (clause, today) => {
    const m = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/.exec(clause);
    if (!m) return undefined;
    const year = m[3]?.length === 2 ? String(TWO_DIGIT_YEAR_BASE + Number(m[3])) : m[3];
    return dayMonth(Number(m[1]), Number(m[2]), year, today);
  },
  // 12 March, 12th of March 2027
  (clause, today) => {
    const pattern = String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH_RE}\b,?\s*(\d{4})?`;
    const m = new RegExp(pattern).exec(clause);
    return m?.[2] ? dayMonth(Number(m[1]), monthIndex(m[2]), m[3], today) : undefined;
  },
  // March 12, March 12th 2027
  (clause, today) => {
    const pattern = String.raw`\b${MONTH_RE}\s+(\d{1,2})(?:st|nd|rd|th)?\b,?\s*(\d{4})?`;
    const m = new RegExp(pattern).exec(clause);
    return m?.[1] ? dayMonth(Number(m[2]), monthIndex(m[1]), m[3], today) : undefined;
  },
];

/** Absolute dates: 2027-03-12, 12/03/2027 (day first, Indian style), 12 March, March 12 2027. */
export function parseExplicitDate(clause: string, today: IsoDate): IsoDate | null {
  for (const parse of DATE_PARSERS) {
    const result = parse(clause, today);
    if (result !== undefined) return result;
  }
  return null;
}
