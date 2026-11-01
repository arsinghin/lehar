import { useState } from 'react';

import { applyTheme, currentTheme, saveTheme, type Theme } from '../lib/theme';
import { Button } from './Button';

/** Switches between light and dark, and remembers the choice. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <Button
      variant="ghost"
      size="s"
      icon={theme === 'dark' ? 'sun' : 'moon'}
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        applyTheme(next);
        saveTheme(next);
        setTheme(next);
      }}
    />
  );
}
