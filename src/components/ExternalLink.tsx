import type { ReactNode } from 'react';

import { Icon, type IconName } from './Icon';

export interface ExternalLinkProps {
  href: string;
  /** What the link does; "(opens in a new tab)" is added for screen readers. */
  label: string;
  icon: IconName;
  children: ReactNode;
}

/** A button-styled link to another site, opened in a new tab without sharing this page. */
export function ExternalLink({ href, label, icon, children }: ExternalLinkProps) {
  return (
    <a
      className="btn btn--ghost btn--s"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} (opens in a new tab)`}
    >
      <Icon name={icon} /> {children}
    </a>
  );
}
