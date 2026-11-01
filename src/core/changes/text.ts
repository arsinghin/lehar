/** Text normalization for the change parser: number words to digits, and splitting into clauses. */

const UNITS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const UNIT_INDEX = new Map(UNITS.map((word, index) => [word, index]));
/** "twenty", "twenty-five", "ninety nine": a tens word, optionally followed by a unit word. */
const TENS_PHRASE = new RegExp(
  String.raw`\b(${Object.keys(TENS).join('|')})(?:[\s-]+(${UNITS.slice(1, 10).join('|')}))?\b`,
  'g',
);
const UNIT_WORD = new RegExp(String.raw`\b(${UNITS.join('|')})\b`, 'g');

/** Lower-cases and converts number words ("fifty", "twenty-five", "a week", "a couple of") to digits. */
export function normalizeNumbers(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\b(?:a\s+)?couple\s+of\b/g, '2')
    .replace(/\ba\s+(fortnight|day|week|month|lakh|lac|crore|hundred|thousand)\b/g, '1 $1')
    .replace(TENS_PHRASE, (_match, tens: string, unit: string | undefined) =>
      String((TENS[tens] ?? 0) + (unit ? (UNIT_INDEX.get(unit) ?? 0) : 0)),
    )
    .replace(UNIT_WORD, (word) => String(UNIT_INDEX.get(word) ?? word))
    .replace(/\b(\d+)\s+hundred\b/g, (_m, n: string) => String(Number(n) * 100))
    .replace(/\bhundred\b/g, '100');
}

/** Splits text into clauses without breaking amounts such as "7,00,000" or "7.5 lakh". */
export function splitClauses(text: string): string[] {
  return text
    .split(/[;!?\n]|\.(?=\s|$)|,\s|\band\b|\balso\b|\bbut\b|\bwhile\b/)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
}
