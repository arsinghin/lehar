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

describe('overview', () => {
  it('lets the host tick off the next task and dismiss the message', async () => {
    const user = userEvent.setup();
    renderWithPlan(<App />, { plan: demo() });
    const doNext = screen.getByRole('region', { name: 'Do next' });
    const first = within(doNext).getAllByRole('button', { name: /^Done: / })[0] as HTMLElement;
    const name = first.getAttribute('aria-label') ?? '';
    await user.click(first);
    expect(within(doNext).queryByRole('button', { name })).not.toBeInTheDocument();
    expect(within(doNext).getByText(/3 of 15 tasks done/)).toBeInTheDocument();

    await user.click(
      within(screen.getByRole('region', { name: 'Ideas for your guests' })).getByRole('button', {
        name: 'Get ideas',
      }),
    );
    expect(screen.getByRole('tab', { name: 'Ideas' })).toHaveAttribute('aria-selected', 'true');
  });

  it('dismisses a notice', async () => {
    const user = userEvent.setup();
    renderWithPlan(<App />, { plan: demo() });
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    await user.selectOptions(await screen.findByLabelText('Surprise buffer'), '5');
    expect(screen.getByRole('status')).toHaveTextContent(/Surprise buffer → 5%/);
    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('opens the timeline from the overview', async () => {
    const user = userEvent.setup();
    renderWithPlan(<App />, { plan: demo('society-mela') });
    await user.click(screen.getByRole('button', { name: 'Open timeline' }));
    expect(await screen.findByRole('heading', { name: 'Timeline' })).toBeInTheDocument();
  });
});
