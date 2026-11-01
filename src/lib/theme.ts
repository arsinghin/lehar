/** Light/dark theme: chosen by the host, otherwise the system preference. */
export type Theme = 'light' | 'dark';

const THEME_KEY = 'lehar:theme';

/** The saved theme, or the system preference when nothing is saved or storage is blocked. */
export function initialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage may be blocked; fall back to the system preference.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The theme the page is showing now. */
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Shows the page in `theme`. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

/** Remembers the choice. A non-essential preference, so storage errors are ignored. */
export function saveTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore: the theme still applies for this visit.
  }
}
