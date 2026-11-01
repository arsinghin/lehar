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

describe('trade-offs', () => {
  it('protects a category so trade-offs leave it alone', async () => {
    const user = userEvent.setup();
    renderWithPlan(<App />, { plan: demo('over-budget') });
    await user.click(screen.getByRole('tab', { name: /Budget/ }));
    const protectDecor = await screen.findByRole('checkbox', { name: 'Protect Decoration' });
    await user.click(protectDecor);
    expect(protectDecor).toBeChecked();
    const panel = screen.getByRole('region', { name: /What matters most/ });
    expect(within(panel).queryByText(/Decoration:/)).not.toBeInTheDocument();
    await user.click(protectDecor);
    expect(
      within(screen.getByRole('region', { name: /What matters most/ })).getByText(/Decoration:/),
    ).toBeInTheDocument();
  });

  it('raises the budget to fit, or picks levers one at a time', async () => {
    const user = userEvent.setup();
    renderWithPlan(<App />, { plan: demo('over-budget') });
    await user.click(screen.getByRole('tab', { name: /Budget/ }));
    const panel = await screen.findByRole('region', { name: /What matters most/ });
    const [firstLever] = within(panel).getAllByRole('checkbox');
    await user.click(firstLever as HTMLElement);
    expect(within(panel).getByText(/With 1 selected/)).toBeInTheDocument();
    await user.click(firstLever as HTMLElement);
    expect(within(panel).getByText('Nothing selected yet.')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: /Or raise the budget to/ }));
    expect(screen.getByRole('status')).toHaveTextContent(
      /Budget raised to ₹7,97,500|The plan now fits/,
    );
    expect(screen.queryByRole('region', { name: /What matters most/ })).not.toBeInTheDocument();
  });
});
