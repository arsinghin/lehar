import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { demo } from '../../../tests/journeys';
import { renderWithPlan } from '../../../tests/render';
import { App } from '../../App';
import { clearAiCache } from '../../lib/apiClient';

afterEach(() => {
  clearAiCache();
  vi.unstubAllGlobals();
});

describe('history', () => {
  it('restores an earlier version from history', async () => {
    const user = userEvent.setup();
    renderWithPlan(<App />, { plan: demo() });
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    await user.selectOptions(await screen.findByLabelText('Style for Venue'), 'premium');
    await user.click(screen.getByRole('tab', { name: 'History' }));
    const restore = await screen.findByRole('button', {
      name: /Restore the plan from before this: Venue style → Premium/,
    });
    await user.click(restore);
    expect((await screen.findAllByText(/Restored the version from before/)).length).toBeGreaterThan(
      0,
    );
    await user.click(screen.getAllByRole('button', { name: 'Undo' })[0] as HTMLElement);
    await user.click(screen.getAllByRole('button', { name: 'Redo' })[0] as HTMLElement);
  });
});

describe('history', () => {
  it('undoes and redoes from the history tab', async () => {
    const user = userEvent.setup();
    renderWithPlan(<App />, { plan: demo() });
    await user.click(screen.getByRole('tab', { name: 'History' }));
    expect(await screen.findByText(/No changes yet/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    await user.selectOptions(await screen.findByLabelText('Style for Photo & video'), 'simple');
    await user.click(screen.getByRole('tab', { name: 'History' }));
    const panel = await screen.findByRole('tabpanel');
    await user.click(within(panel).getByRole('button', { name: 'Undo' }));
    expect(within(panel).getByText(/No changes yet/)).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Redo' }));
    expect(within(panel).getByText('Photo & video style → Simple')).toBeInTheDocument();
  });
});
