/** Helpers for UI journey tests: demo plans, a stubbed AI service, and opening a demo from home. */
import { screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { App } from '../src/App';
import { createDemoPlan, type DemoId } from '../src/core/demo';
import { TODAY } from './fixtures';
import { renderWithPlan } from './render';

/** A demo plan built for the fixed test date. */
export const demo = (id: DemoId = 'wedding') =>
  createDemoPlan(id, { id: 'demo', now: '2026-10-26T10:00:00.000Z', today: TODAY });

/** Makes every AI request fail as if the network were down. */
export function offline() {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new TypeError('offline'))),
  );
}

/** Makes every AI request succeed with `data` for `task`, labelled as coming from `source`. */
export function aiReturns(task: string, data: unknown, source = 'gemini') {
  const fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          ok: true,
          task,
          data,
          meta: { source, model: 'gemini-3.8-flash', cached: false, requestId: 'r' },
        }),
        { status: 200 },
      ),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Renders the app from the home page and opens the wedding demo. */
export async function openWeddingDemo(user: ReturnType<typeof userEvent.setup>) {
  renderWithPlan(<App />);
  await user.click(screen.getByRole('button', { name: /A wedding, 4 months away/ }));
  await screen.findByRole('heading', { level: 1, name: /Riya & Arjun’s wedding/ });
}
