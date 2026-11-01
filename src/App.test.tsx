import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { offline, openWeddingDemo } from '../tests/journeys';
import { axeViolations, renderWithPlan } from '../tests/render';
import { App } from './App';
import { clearAiCache } from './lib/apiClient';

afterEach(() => {
  clearAiCache();
  vi.unstubAllGlobals();
});

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
