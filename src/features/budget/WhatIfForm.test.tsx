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

describe('what-if', () => {
  it('reports "nothing changed" for an unchanged what-if', async () => {
    const user = userEvent.setup();
    renderWithPlan(<App />, { plan: demo() });
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    await user.click(await screen.findByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('status')).toHaveTextContent('Nothing changed.');
  });
});
