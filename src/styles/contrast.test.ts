/**
 * Verifies WCAG 2.2 AA contrast for every text/background pair actually used, in both themes, by
 * reading the real token file. jsdom cannot compute contrast, so this test covers it instead.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1] ?? '', m[2] ?? '']),
  );
}

const light = block(':root');
const dark = { ...light, ...block(":root[data-theme='dark']") };

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** [foreground, background, minimum ratio] */
const TEXT_PAIRS: [string, string, number][] = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'surface-2', 4.5],
  ['text-muted', 'bg', 4.5],
  ['text-muted', 'surface', 4.5],
  ['text-muted', 'surface-2', 4.5],
  ['accent-strong', 'bg', 4.5],
  ['accent-strong', 'surface', 4.5],
  ['on-accent', 'accent', 4.5],
  ['on-accent', 'accent-strong', 4.5],
  ['text', 'accent-soft', 4.5],
  ['ok', 'ok-soft', 4.5],
  ['warn', 'warn-soft', 4.5],
  ['danger', 'danger-soft', 4.5],
  ['danger', 'surface', 4.5],
  ['info', 'info-soft', 4.5],
  ['text', 'ok-soft', 4.5],
  ['text', 'warn-soft', 4.5],
  ['text', 'danger-soft', 4.5],
  ['text', 'info-soft', 4.5],
  // Non-text UI: focus ring and input borders need 3:1 (WCAG 1.4.11).
  ['focus', 'bg', 3],
  ['focus', 'surface', 3],
  ['text-muted', 'surface', 3],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (_name, tokens) => {
  it.each(TEXT_PAIRS)('%s on %s ≥ %d:1', (fg, bg, min) => {
    const a = tokens[fg];
    const b = tokens[bg];
    expect(a, `missing --${fg}`).toBeDefined();
    expect(b, `missing --${bg}`).toBeDefined();
    expect(contrast(a ?? '', b ?? '')).toBeGreaterThanOrEqual(min);
  });
});

describe('contrast helper', () => {
  it('matches known values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });
});
