import { useState } from 'react';

import { Button } from './Button';

export type Theme = 'light' | 'dark';
const THEME_KEY = 'lehar:theme';

export function initialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage may be blocked; fall back to the system preference.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <Button
      variant="ghost"
      size="s"
      icon={theme === 'dark' ? 'sun' : 'moon'}
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        applyTheme(next);
        setTheme(next);
        try {
          window.localStorage.setItem(THEME_KEY, next);
        } catch {
          // Non-essential preference; ignore storage errors.
        }
      }}
    />
  );
}
