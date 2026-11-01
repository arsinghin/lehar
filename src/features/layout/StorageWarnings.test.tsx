import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { demo } from '../../../tests/journeys';
import { renderWithPlan } from '../../../tests/render';
import { App } from '../../App';
import { clearAiCache } from '../../lib/apiClient';
import { STORAGE_KEY } from '../../state/persistence';

afterEach(() => {
  clearAiCache();
  vi.unstubAllGlobals();
});

describe('storage warnings', () => {
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
