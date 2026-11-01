import { screen } from '@testing-library/react';
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

describe('vendors', () => {
  it('compares sample quotes, accepts one into the budget, and adds a new quote', async () => {
    const user = userEvent.setup();
    renderWithPlan(<App />, { plan: demo() });
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    await user.click(await screen.findByRole('button', { name: 'Food & catering' }));
    expect(screen.getByRole('button', { name: 'Food & catering' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Covers 180 of 200 guests')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Find caterers near Pune on Google Maps/ }),
    ).toHaveAttribute('href', expect.stringContaining('google.com/maps/search') as string);

    await user.click(screen.getByRole('button', { name: 'Accept Caterer A (sample)' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      /now replaces the food & catering estimate/,
    );
    await user.click(screen.getByRole('button', { name: 'Shortlist Caterer B (sample)' }));
    await user.click(screen.getByRole('button', { name: 'Remove Caterer B (sample)' }));
    expect(screen.queryByText('Caterer B (sample)')).not.toBeInTheDocument();

    await user.click(screen.getByText('Add a quote you received'));
    await user.click(screen.getByRole('button', { name: 'Add quote' }));
    expect(screen.getByText('Give the vendor a name or label.')).toBeInTheDocument();
    expect(screen.getByText(/Enter the quoted total/)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /^Vendor/ }), 'Annapurna Caterers');
    await user.type(screen.getByLabelText(/Quoted total/), '2.4 lakh');
    await user.type(screen.getByLabelText(/Guests covered/), 'lots');
    await user.click(screen.getByRole('button', { name: 'Add quote' }));
    expect(screen.getByText('Enter a whole number of guests.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Guests covered/));
    await user.type(screen.getByLabelText(/Guests covered/), '220');
    await user.click(screen.getByRole('checkbox', { name: 'GST / taxes' }));
    await user.click(screen.getByRole('button', { name: 'Add quote' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      /Added Annapurna Caterers's quote of ₹2,40,000/,
    );
    expect(screen.getByRole('rowheader', { name: /Annapurna Caterers/ })).toBeInTheDocument();
  });

  it('adds AI questions tailored to the event, with a source label', async () => {
    const user = userEvent.setup();
    aiReturns('vendorQuestions', {
      questions: ['Can you run a separate Jain counter for 40 guests?'],
    });
    renderWithPlan(<App />, { plan: demo() });
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    await user.click(await screen.findByRole('button', { name: 'Suggest questions for my event' }));
    expect(
      await screen.findByText('Can you run a separate Jain counter for 40 guests?'),
    ).toBeInTheDocument();
    expect(screen.getByText('AI suggestion · Google Gemini')).toBeInTheDocument();
  });

  it('reports rejected input from the AI service', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              ok: false,
              error: { message: 'Please describe your event in your own words.' },
            }),
            { status: 422 },
          ),
        ),
      ),
    );
    renderWithPlan(<App />, { plan: demo() });
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    await user.click(await screen.findByRole('button', { name: 'Suggest questions for my event' }));
    expect(
      await screen.findByText('Please describe your event in your own words.'),
    ).toBeInTheDocument();
  });
});
