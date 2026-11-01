/**
 * Extracts the outermost JSON object from model output, tolerating markdown fences or a sentence
 * around it. Throws SyntaxError when there is no parsable object.
 */
export function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new SyntaxError('No JSON object in model output');
  return JSON.parse(text.slice(start, end + 1));
}
