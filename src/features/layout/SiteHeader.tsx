import { Icon } from '../../components/Icon';
import { ThemeToggle } from '../../components/ThemeToggle';

export interface SiteHeaderProps {
  onHome: () => void;
}

/** The top bar: the logo (back to the home page) and the theme switch. */
export function SiteHeader({ onHome }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <button type="button" className="brand" aria-label="Lehar home" onClick={onHome}>
          <Icon name="logo" />
          Lehar
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
