import { screen } from '@testing-library/react';
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

describe('plan files', () => {
  it('exports, prints and imports plan files with validation', async () => {
    const user = userEvent.setup();
    renderWithPlan(<App />, { plan: demo() });
    await user.click(screen.getByText('More'));
    await user.click(screen.getByRole('button', { name: 'Save plan as a file' }));
    await user.click(screen.getByRole('button', { name: 'Export calendar (.ics)' }));
    await user.click(screen.getByRole('button', { name: 'Print or save as PDF' }));
    expect(window.print).toHaveBeenCalled();

    const input = screen.getByLabelText('Load a plan file', { selector: 'input' });
    await user.upload(input, new File(['{"nope":true}'], 'bad.json', { type: 'application/json' }));
    expect(await screen.findByText('That file is not a valid Lehar plan.')).toBeInTheDocument();
    const good = demo('society-mela');
    await user.upload(
      input,
      new File([JSON.stringify(good)], 'mela.json', { type: 'application/json' }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Green Meadows Diwali Mela' }),
    ).toBeInTheDocument();

    await user.click(screen.getByText('More'));
    await user.click(screen.getByRole('button', { name: 'Start a new plan' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Plan a new celebration' }),
    ).toBeInTheDocument();
  });
});
