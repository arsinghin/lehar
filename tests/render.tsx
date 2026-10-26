import { render, type RenderResult } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement } from 'react';

import { NoticeProvider } from '../src/components/Notice';
import { PlanProvider } from '../src/state/PlanContext';
import { STORAGE_KEY } from '../src/state/persistence';
import type { PlanState } from '../src/core/schemas';
import { TODAY } from './fixtures';

/**
 * Renders inside the real store with a fixed "today", optionally pre-loading a plan. `<App>` brings
 * its own notice region; pass `withNotice` when rendering a single screen in isolation.
 */
export function renderWithPlan(
  ui: ReactElement,
  options: { plan?: PlanState; withNotice?: boolean } = {},
): RenderResult {
  if (options.plan) {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ storeVersion: 1, plan: options.plan, past: [] }),
    );
  }
  return render(
    <PlanProvider today={TODAY}>
      {options.withNotice ? <NoticeProvider>{ui}</NoticeProvider> : ui}
    </PlanProvider>,
  );
}

/** Runs axe-core on a container. Colour contrast is verified separately because jsdom cannot compute it. */
export async function axeViolations(container: Element): Promise<string[]> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map(
    (violation) => `${violation.id}: ${violation.help} (${String(violation.nodes.length)})`,
  );
}
