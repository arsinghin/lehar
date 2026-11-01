import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { axeViolations, renderWithPlan } from '../tests/render';
import { App } from './App';
import { clearAiCache } from './lib/apiClient';

afterEach(() => {
  clearAiCache();
  vi.unstubAllGlobals();
});

function offline() {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new TypeError('offline'))),
  );
}

async function openWeddingDemo(user: ReturnType<typeof userEvent.setup>) {
  renderWithPlan(<App />);
  await user.click(screen.getByRole('button', { name: /A wedding, 4 months away/ }));
  await screen.findByRole('heading', { level: 1, name: /Riya & Arjun’s wedding/ });
}

describe('home', () => {
  it('explains the product and has no accessibility violations', async () => {
    const { container } = renderWithPlan(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Lehar handles the ripples/,
    );
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('the logo leads home from an open plan, and Continue goes back to it', async () => {
    const user = userEvent.setup();
    await openWeddingDemo(user);
    await user.click(screen.getByRole('button', { name: 'Lehar home' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Lehar handles the ripples/,
    );
    await user.click(screen.getByRole('button', { name: 'Continue Riya & Arjun’s wedding' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /Riya & Arjun’s wedding/ }),
    ).toBeInTheDocument();

    // From home, another demo opens straight into its workspace.
    await user.click(screen.getByRole('button', { name: 'Lehar home' }));
    await user.click(screen.getByRole('button', { name: /A 6th birthday party/ }));
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(/Riya & Arjun/);
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
  });

  it('toggles the theme and remembers it', async () => {
    const user = userEvent.setup();
    renderWithPlan(<App />);
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('lehar:theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });
});

describe('a combined change, end to end', () => {
  it('previews every ripple, applies on confirmation, and can be undone', async () => {
    const user = userEvent.setup();
    offline();
    await openWeddingDemo(user);

    await user.click(screen.getByRole('button', { name: 'Try a sample change' }));
    const dialog = await screen.findByRole('dialog', { name: 'Something changed?' });
    expect(within(dialog).getByRole('textbox', { name: /What changed/ })).toHaveValue(
      'We now have 50 more guests, our budget is down by 10%, and the event is happening 2 weeks earlier.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Preview the ripple' }));

    expect(await within(dialog).findByText('Budget ripple')).toBeInTheDocument();
    expect(
      within(dialog)
        .getByText(/Guests:/)
        .closest('li'),
    ).toHaveTextContent('200 → 250');
    expect(
      within(dialog)
        .getByText(/Budget:/)
        .closest('li'),
    ).toHaveTextContent('₹8,00,000 → ₹7,20,000');
    expect(
      within(dialog)
        .getByText(/Caterer A \(sample\):/)
        .closest('li'),
    ).toHaveTextContent(/revised quote for 250/);
    expect(
      within(dialog).getByText(/Kept as they are: 2 completed tasks, 2 quotes/),
    ).toBeInTheDocument();
    expect(await axeViolations(dialog)).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Apply changes' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('status')).toHaveTextContent(/Applied: Guests: 200 → 250/);
    expect(screen.getAllByText('Over budget').length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole('button', { name: 'Undo' })[0] as HTMLElement);
    expect(screen.getByRole('heading', { level: 1 }).parentElement).toHaveTextContent('200 guests');
  });

  it('asks a clarifying question for vague changes instead of guessing', async () => {
    const user = userEvent.setup();
    offline();
    await openWeddingDemo(user);
    await user.click(screen.getByRole('button', { name: 'Something changed?' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'Our budget has decreased a bit');
    await user.click(within(dialog).getByRole('button', { name: 'Preview the ripple' }));
    expect(
      await within(dialog).findByText(/By how much did the budget change/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Apply changes' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  });

  it('validates an empty change and closes on Escape-equivalent cancel', async () => {
    const user = userEvent.setup();
    await openWeddingDemo(user);
    await user.click(screen.getByRole('button', { name: 'Something changed?' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Preview the ripple' }));
    expect(within(dialog).getByText(/Describe what changed/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

describe('workspace tabs', () => {
  it('supports arrow-key navigation and every panel is accessible', async () => {
    const user = userEvent.setup();
    offline();
    await openWeddingDemo(user);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Overview',
      'Budget',
      'Timeline',
      'Vendors',
      'Ideas',
      'History',
    ]);

    tabs[0]?.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Budget' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Budget' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');

    for (const name of ['Overview', 'Budget', 'Timeline', 'Vendors', 'Ideas', 'History']) {
      await user.click(screen.getByRole('tab', { name }));
      const panel = await screen.findByRole('tabpanel');
      await within(panel).findAllByRole('heading', { level: 2 });
      expect(await axeViolations(document.body), `${name} panel`).toEqual([]);
    }
  });
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
    expect(screen.getByText(/Enter 1–5,000 guests/)).toBeInTheDocument();
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
