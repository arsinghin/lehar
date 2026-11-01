/**
 * Output sanitizing for model text. Even with a strict prompt, a model may echo a URL, a phone
 * number or a price, so they are removed before anything reaches the browser. React escapes output
 * anyway; stripping tags here is defence in depth.
 */

const TAGS = /<[^>]{0,200}>/g;
const URLS = /\b(?:https?:\/\/|www\.)\S+/gi;
const EMAILS = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONES = /\+?\d[\d\s-]{8,}\d/g;
const RUPEE_AMOUNTS =
  /(?:₹|\brs\.?|\binr)\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:lakhs?|lacs?|crores?|cr|k)\b)?/gi;
const UNIT_AMOUNTS = /\b\d[\d,]*(?:\.\d+)?\s*(?:lakhs?|lacs?|crores?)\b/gi;

/** C0/C1 control characters, zero-width characters and bidi overrides, as inclusive ranges. */
const HIDDEN_RANGES: readonly (readonly [number, number])[] = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
];
/** Tab and newline are control characters but keep text readable. */
const ALLOWED_CONTROLS = new Set([0x09, 0x0a]);

function isInvisibleOrControl(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  if (ALLOWED_CONTROLS.has(code)) return false;
  return HIDDEN_RANGES.some(([from, to]) => code >= from && code <= to);
}

/** Removes characters that can hide or disguise text. */
export function stripInvisible(value: string): string {
  return Array.from(value)
    .filter((char) => !isInvisibleOrControl(char))
    .join('');
}

/** Model text with links, contacts, prices, tags and hidden characters removed, cut to `maxLength`. */
export function sanitizeModelText(value: string, maxLength: number): string {
  return stripInvisible(value.normalize('NFKC'))
    .replace(TAGS, '')
    .replace(URLS, '')
    .replace(EMAILS, '')
    .replace(PHONES, '')
    .replace(RUPEE_AMOUNTS, '')
    .replace(UNIT_AMOUNTS, '')
    .replace(/[<>]/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
    .slice(0, maxLength)
    .trim();
}
