import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TODAY } from '../../../tests/fixtures';
import { axeViolations, renderWithPlan } from '../../../tests/render';
import { App } from '../../App';
import { addDays } from '../../core/dates';
import { clearAiCache } from '../../lib/apiClient';
import { STORAGE_KEY } from '../../state/persistence';

afterEach(() => {
  clearAiCache();
  vi.unstubAllGlobals();
});

describe('intake wizard', () => {
  it('asks the practical questions step by step, validates, and creates a plan', async () => {
    const user = userEvent.setup();
    const { container } = renderWithPlan(<App />);
    await user.click(screen.getByRole('button', { name: 'Start a new plan' }));
    await screen.findByRole('heading', { level: 1, name: 'Plan a new celebration' });
    expect(await axeViolations(container)).toEqual([]);

    await user.click(screen.getByRole('radio', { name: /Birthday/ }));
    const date = screen.getByLabelText('Event date');
    fireEvent.change(date, { target: { value: addDays(TODAY, -2) } });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const summary = await screen.findByRole('alert');
    expect(summary).toHaveTextContent('The event date cannot be in the past.');
    await waitFor(() => {
      expect(summary).toHaveFocus();
    });
    await user.click(within(summary).getByRole('link'));
    expect(date).toHaveFocus();
    expect(date).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(date, { target: { value: addDays(TODAY, 30) } });
    await user.type(screen.getByLabelText(/Name for this plan/), 'Aarav turns 6');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByRole('heading', { name: /Guests and budget/ });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/2 things/);
    await user.type(screen.getByLabelText(/How many guests/), '30');
    await user.type(screen.getByLabelText('Total budget'), '60k');
    expect(screen.getByText('= ₹60,000')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Simple/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByRole('heading', { name: /What matters most/ });
    const slider = screen.getByRole('slider', { name: 'Decoration' });
    fireEvent.change(slider, { target: { value: '5' } });
    expect(slider).toHaveAttribute('aria-valuetext', '5 of 5: Must be great');
    await user.click(screen.getByRole('checkbox', { name: 'Protect Food & catering' }));
    await user.click(
      screen.getByRole('checkbox', { name: /Never suggest cutting the guest list/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByRole('heading', { name: /guests’ needs/ });
    await user.click(screen.getByRole('checkbox', { name: 'Young children' }));
    await user.click(screen.getByRole('checkbox', { name: 'Jain' }));
    await user.click(screen.getByRole('checkbox', { name: 'Wheelchair access' }));
    await user.type(screen.getByLabelText(/Traditions or culture/), 'Gujarati');
    await user.type(screen.getByLabelText(/Absolute must-haves/), 'Nut-free cake');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByRole('heading', { name: /Review/ });
    expect(screen.getByText('₹60,000')).toBeInTheDocument();
    expect(screen.getByText('Food & catering')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('heading', { name: /guests’ needs/ });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Create my plan' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Aarav turns 6' }),
    ).toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      plan: { profile: Record<string, unknown> };
    };
    expect(stored.plan.profile).toMatchObject({
      eventType: 'birthday',
      guests: 30,
      budget: 60_000,
      tier: 'simple',
      lockGuestCount: true,
      culture: 'Gujarati',
    });
  });

  it('can be cancelled', async () => {
    const user = userEvent.setup();
    renderWithPlan(<App />);
    await user.click(screen.getByRole('button', { name: 'Start a new plan' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Plan the celebration/);
  });
});
