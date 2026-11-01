/** Indian-rupee formatting and parsing ("8 lakh", "₹7,50,000", "1.2 Cr", "45k"). */

const INR_FORMAT = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const NUMBER_FORMAT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

const CRORE = 10_000_000;
const LAKH = 100_000;
const THOUSAND = 1_000;

const UNIT_MULTIPLIERS: Record<string, number> = {
  crore: CRORE,
  crores: CRORE,
  cr: CRORE,
  lakh: LAKH,
  lakhs: LAKH,
  lac: LAKH,
  lacs: LAKH,
  l: LAKH,
  k: THOUSAND,
  thousand: THOUSAND,
};

/**
 * One amount with an optional currency prefix and unit suffix.
 * Group 1 = digits (Indian or western commas allowed), group 2 = unit.
 */
export const AMOUNT_PATTERN =
  /(?:₹|\brs\.?|\binr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|lac|l|k|thousand)?(?![a-z])/i;

/** Whole rupees with Indian digit grouping: "₹8,00,000". */
export function formatInr(amount: number): string {
  return INR_FORMAT.format(Math.round(amount));
}

/** A number with Indian digit grouping: "1,20,000". */
export function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value);
}

/** "+₹12,000" / "−₹5,000" / "₹0". Uses a true minus sign for screen readers and typography. */
export function formatSignedInr(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded === 0) return formatInr(0);
  return `${rounded > 0 ? '+' : '−'}${formatInr(Math.abs(rounded))}`;
}

/** Converts a matched AMOUNT_PATTERN result into whole rupees. */
export function amountFromMatch(digits: string, unit: string | undefined): number | null {
  const value = Number(digits.replace(/,/g, ''));
  if (!Number.isFinite(value)) return null;
  const multiplier = unit ? (UNIT_MULTIPLIERS[unit.toLowerCase()] ?? 1) : 1;
  return Math.round(value * multiplier);
}

/** Parses the first rupee amount in free text. Returns null when there is none. */
export function parseInrAmount(text: string): number | null {
  const match = AMOUNT_PATTERN.exec(text);
  if (!match?.[1]) return null;
  return amountFromMatch(match[1], match[2]);
}

/** Rounds to the nearest multiple of `step` (e.g. ₹100) so estimates never look falsely precise. */
export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
