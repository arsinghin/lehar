import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { aiReturns, demo } from '../../../tests/journeys';
import { renderWithPlan } from '../../../tests/render';
import { App } from '../../App';
import { clearAiCache } from '../../lib/apiClient';

afterEach(() => {
  clearAiCache();
  vi.unstubAllGlobals();
});

describe('ideas', () => {
  it('generates ideas offline with an honest label, and refines them', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('offline'))),
    );
    renderWithPlan(<App />, { plan: demo('kids-birthday') });
    await user.click(screen.getByRole('tab', { name: 'Ideas' }));
    await user.click(await screen.findByRole('button', { name: 'Suggest 3 ideas for my event' }));
    expect(await screen.findAllByRole('heading', { level: 3 })).toHaveLength(3);
    expect(screen.getByText('Built-in suggestion')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/built-in suggestions/);

    const firstCard = screen
      .getAllByRole('listitem')
      .find((item) => item.classList.contains('idea'));
    if (!firstCard) throw new Error('no idea card');
    await user.click(within(firstCard).getByRole('button', { name: 'Cheaper' }));
    expect(await screen.findByText(/Last refinement: “Make it cheaper/)).toBeInTheDocument();

    const card = screen.getAllByRole('listitem').find((item) => item.classList.contains('idea'));
    if (!card) throw new Error('no idea card');
    await user.click(within(card).getByRole('button', { name: /^Refine / }));
    expect(within(card).getByText('Describe what you would like to change.')).toBeInTheDocument();
    await user.type(within(card).getByRole('textbox'), 'keep it outdoors');
    await user.click(within(card).getByRole('button', { name: /^Refine / }));
    expect(await screen.findByText(/Last refinement: “keep it outdoors”/)).toBeInTheDocument();
  });

  it('shows Gemini ideas and exactly what was sent', async () => {
    const user = userEvent.setup();
    aiReturns('ideas', {
      ideas: [
        {
          title: 'Space mission',
          summary: 'Rockets',
          decor: 'Stars',
          food: 'Moon pies',
          activity: 'Countdown',
          whyItFits: 'Kids love it',
          costLevel: 'similar',
        },
      ],
    });
    renderWithPlan(<App />, { plan: demo('kids-birthday') });
    await user.click(screen.getByRole('tab', { name: 'Ideas' }));
    await user.click(await screen.findByRole('button', { name: 'Suggest 3 ideas for my event' }));
    expect(await screen.findByRole('heading', { name: 'Space mission' })).toBeInTheDocument();
    expect(screen.getByText('AI suggestion · Google Gemini')).toBeInTheDocument();
    await user.click(screen.getByText('What Lehar sends to the AI'));
    expect(screen.getByText(/"budgetBand"/)).toBeInTheDocument();
    expect(screen.queryByText(/Aarav/, { selector: 'pre' })).not.toBeInTheDocument();
  });
});
