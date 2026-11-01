import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { openWeddingDemo } from '../../../tests/journeys';
import { renderWithPlan } from '../../../tests/render';
import { App } from '../../App';
import { clearAiCache } from '../../lib/apiClient';

afterEach(() => {
  clearAiCache();
  vi.unstubAllGlobals();
});

describe('budget and trade-offs', () => {
  it('shows ranked trade-offs for the 20% over-budget demo and applies only what the host picks', async () => {
    const user = userEvent.setup();
    renderWithPlan(<App />);
    await user.click(screen.getByRole('button', { name: /Same wedding, 20% over budget/ }));
    await user.click(await screen.findByRole('button', { name: 'See trade-offs' }));

    const panel = await screen.findByRole('region', { name: /over\. What matters most/ });
    const options = within(panel).getAllByRole('checkbox');
    expect(options.length).toBeGreaterThan(3);
    expect(options.every((option) => !(option as HTMLInputElement).checked)).toBe(true);
    expect(within(panel).queryByText(/Food & catering:/)).not.toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Select Lehar’s suggestion' }));
    expect(within(panel).getByText(/within budget/)).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Apply selected' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Applied \d trade-off/);
    expect(screen.queryByRole('region', { name: /What matters most/ })).not.toBeInTheDocument();
  });

  it('changes a category style and reports the ripple', async () => {
    const user = userEvent.setup();
    await openWeddingDemo(user);
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    await user.selectOptions(await screen.findByLabelText('Style for Decoration'), 'premium');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Decoration style → Premium: +₹69,300 on the total',
    );
  });

  it('runs a what-if and validates its inputs', async () => {
    const user = userEvent.setup();
    await openWeddingDemo(user);
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    const guests = await screen.findByLabelText('Guests');
    await user.clear(guests);
    await user.type(guests, 'many');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText(/number of guests as a whole number/)).toBeInTheDocument();
    await user.clear(guests);
    await user.type(guests, '150');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('status')).toHaveTextContent(/What-if: guests 200 → 150/);
  });

  it('edits and resets a price assumption', async () => {
    const user = userEvent.setup();
    await openWeddingDemo(user);
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    await user.click(await screen.findByText(/See and edit the price assumptions/));
    const group = screen.getByRole('group', { name: /Food & catering/ });
    const perGuest = within(group).getByLabelText('Per guest (₹)');
    await user.clear(perGuest);
    await user.type(perGuest, 'abc');
    await user.click(within(group).getByRole('button', { name: /Save/ }));
    expect(within(group).getByText('Enter whole rupee amounts.')).toBeInTheDocument();
    await user.clear(perGuest);
    await user.type(perGuest, '900');
    await user.click(within(group).getByRole('button', { name: /Save/ }));
    expect(screen.getByRole('status')).toHaveTextContent(
      /Food & catering: your own rate: −₹44,000/,
    );
    await user.click(
      within(screen.getByRole('group', { name: /Food & catering/ })).getByRole('button', {
        name: /Reset/,
      }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(/back to Lehar’s default/);
  });
});
