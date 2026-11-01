/**
 * Heuristic prompt-injection screen for the few free-text fields (change requests, refinements,
 * culture, must-haves). It is one layer of several: user data is also JSON-encoded inside delimiters,
 * and the model's output is schema-validated and sanitized. False positives are acceptable here
 * because the user can simply rephrase.
 */

const INJECTION_PATTERNS: readonly RegExp[] = [
  /\bignore\s+(?:all\s+|any\s+|the\s+|your\s+)?(?:previous|prior|above|earlier|system)\s+(?:instructions?|prompts?|rules?|messages?)/i,
  /\bdisregard\s+(?:all\s+|the\s+|your\s+|any\s+)?(?:previous\s+|prior\s+|above\s+)?(?:instructions?|rules?|prompts?|guidelines?)/i,
  /\bforget\s+(?:all\s+|your\s+|the\s+)?(?:previous\s+)?(?:instructions?|rules?)/i,
  /\b(?:system|developer|hidden)\s+(?:prompt|message|instructions?)\b/i,
  /\byou\s+are\s+(?:now|no\s+longer)\b/i,
  /\b(?:reveal|print|show|repeat|output)\b[^.]{0,40}\b(?:prompt|instructions?|api[\s_-]?key|secret|password)s?\b/i,
  /\b(?:api[\s_-]?key|secret[\s_-]?key|access[\s_-]?token)\b/i,
  /<\/?\s*(?:system|assistant|user|script|event_data)\b/i,
  /\bjailbreak\b|\bDAN\s+mode\b/i,
];

/** True when free text looks like an attempt to give the model instructions. */
export function looksLikePromptInjection(text: string): boolean {
  const normalized = text.normalize('NFKC');
  return INJECTION_PATTERNS.some((pattern) => pattern.test(normalized));
}
