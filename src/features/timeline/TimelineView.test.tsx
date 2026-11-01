import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { plan, TODAY } from '../../../tests/fixtures';
import { demo } from '../../../tests/journeys';
import { renderWithPlan } from '../../../tests/render';
import { App } from '../../App';
import { addDays } from '../../core/dates';
import { clearAiCache } from '../../lib/apiClient';

afterEach(() => {
  clearAiCache();
  vi.unstubAllGlobals();
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
