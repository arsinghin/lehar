/**
 * Output sanitising for model text. Even with a strict prompt, a model may echo a URL, a phone
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

/** C0/C1 control characters (except tab and newline), zero-width characters and bidi overrides. */
function isInvisibleOrControl(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  if (code === 0x09 || code === 0x0a) return false;
  return (
    code < 0x20 ||
    (code >= 0x7f && code <= 0x9f) ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  );
}

/** Removes characters that can hide or disguise text. */
export function stripInvisible(value: string): string {
  return Array.from(value)
    .filter((char) => !isInvisibleOrControl(char))
    .join('');
}

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

/** Extracts a JSON object from model text that may be wrapped in a code fence or prose. */
export function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new SyntaxError('No JSON object in model output');
  return JSON.parse(text.slice(start, end + 1));
}
