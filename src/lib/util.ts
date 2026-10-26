/** Joins class names, skipping falsy values. */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

/** Short random id for quotes and plans. */
export function newId(): string {
  return crypto.randomUUID();
}

/** Triggers a download of in-memory text. No network involved. */
export function downloadText(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Safe file name from a title, e.g. "Riya & Arjun’s wedding" → "riya-arjun-s-wedding". */
export function slugify(value: string, fallback = 'lehar-plan'): string {
  const slug = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || fallback;
}
