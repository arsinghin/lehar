/** Joins class names, skipping falsy values. */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

/** A random UUID for quotes and plans. */
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

const MAX_SLUG_LENGTH = 60;

/** Safe file name from a title, e.g. "Riya & Arjun’s wedding" → "riya-arjun-s-wedding". */
export function slugify(value: string, fallback = 'lehar-plan'): string {
  const slug = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH);
  return slug || fallback;
}

/** Adds `item` to the list (once) or removes it. */
export function toggleItem<T>(list: readonly T[], item: T, on: boolean): T[] {
  const without = list.filter((existing) => existing !== item);
  return on ? [...without, item] : without;
}

/** "1 task" / "3 tasks". Pass `many` for irregular plurals. */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}
