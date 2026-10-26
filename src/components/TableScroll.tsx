import type { ReactNode } from 'react';

/**
 * Horizontally scrollable table container. It is a named, focusable region so keyboard users can
 * scroll it (WCAG 2.1.1, axe "scrollable-region-focusable"), and it is positioned so visually-hidden
 * labels inside cells cannot widen the page at narrow widths (WCAG 1.4.10 reflow).
 */
export function TableScroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be keyboard reachable
    <div className="table-wrap" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
