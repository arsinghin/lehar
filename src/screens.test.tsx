import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { plan, TODAY } from '../tests/fixtures';
import { axeViolations, renderWithPlan } from '../tests/render';
import { App } from './App';
import { addDays } from './core/dates';
import { createDemoPlan } from './core/plan';
import { clearAiCache } from './lib/apiClient';
import { STORAGE_KEY } from './state/persistence';

afterEach(() => {
  clearAiCache();
  vi.unstubAllGlobals();
});

const demo = (id: Parameters<typeof createDemoPlan>[0] = 'wedding') =>
  createDemoPlan(id, { id: 'demo', now: '2026-10-26T10:00:00.000Z', today: TODAY });

function aiReturns(task: string, data: unknown, source = 'gemini') {
  const fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          ok: true,
          task,
          data,
          meta: { source, model: 'gemini-3.8-flash', cached: false, requestId: 'r' },
        }),
        {
          status: 200,
        },
      ),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

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

describe('timeline', () => {
  it('marks tasks done, delays with a ripple message, and links to Google Calendar', async () => {
    const user = userEvent.setup();
    renderWithPlan(<App />, { plan: demo() });
    await user.click(screen.getByRole('tab', { name: 'Timeline' }));
    const venue = await screen.findByRole('checkbox', { name: 'Shortlist and book the venue' });
    await user.click(venue);
    expect(venue).toBeChecked();

    const delaySelect = screen.getByLabelText('Delay “Book the caterer after a tasting” by');
    await user.selectOptions(delaySelect, '14');
    await user.click(
      screen.getByRole('button', { name: 'Delay Book the caterer after a tasting' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      /delayed by 14 days\. This ripples to \d+ dependent tasks/,
    );
    expect(screen.getAllByText('Moved 14 days later').length).toBeGreaterThan(1);
    await user.click(
      screen.getByRole('button', { name: 'Clear delay for Book the caterer after a tasting' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(/Delay cleared/);

    const calendarLink = screen.getAllByRole('link', { name: /Google Calendar/ })[0];
    expect(calendarLink).toHaveAttribute(
      'href',
      expect.stringContaining('calendar.google.com') as string,
    );
    expect(calendarLink).toHaveAttribute('rel', 'noopener noreferrer');

    await user.click(screen.getByRole('button', { name: /Add all to my calendar/ }));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('warns about compressed and overdue timelines on the overview', async () => {
    renderWithPlan(<App />, {
      plan: plan({ startDate: addDays(TODAY, -40) }, { eventDate: addDays(TODAY, 20) }),
    });
    expect(await screen.findByText('The timeline is compressed')).toBeInTheDocument();
    expect(screen.getByText(/tasks are overdue/)).toBeInTheDocument();
  });
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

describe('history, files and storage', () => {
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

  it('warns when a saved plan is damaged', () => {
    window.localStorage.setItem(STORAGE_KEY, '{"storeVersion":1,"plan":{"bad":true},"past":[]}');
    renderWithPlan(<App />);
    expect(screen.getByText('A saved plan could not be read')).toBeInTheDocument();
  });

  it('warns when the browser blocks storage', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ storeVersion: 1, plan: demo(), past: [] }),
    );
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderWithPlan(<App />);
    expect(await screen.findByText('Your browser is not saving this plan')).toBeInTheDocument();
    spy.mockRestore();
  });
});
