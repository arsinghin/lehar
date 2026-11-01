// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyTheme, currentTheme, initialTheme, saveTheme } from './theme';

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

const prefersDark = (matches: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches })),
  );
};

describe('theme', () => {
  it('uses the saved choice first, then the system preference', () => {
    prefersDark(true);
    expect(initialTheme()).toBe('dark');
    saveTheme('light');
    expect(initialTheme()).toBe('light');
  });

  it('falls back to the system preference when storage is blocked', () => {
    prefersDark(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(initialTheme()).toBe('light');
    expect(() => {
      saveTheme('dark');
    }).not.toThrow();
    vi.restoreAllMocks();
  });

  it('applies the theme to the document', () => {
    expect(currentTheme()).toBe('light');
    applyTheme('dark');
    expect(currentTheme()).toBe('dark');
  });
});
