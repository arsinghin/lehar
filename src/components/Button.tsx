import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from '../lib/util';
import { Icon, type IconName } from './Icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'm' | 's';
  busy?: boolean;
  icon?: IconName;
  children?: ReactNode;
}

/** The app button: a variant, an optional icon, and a busy state that disables it and shows a spinner. */
export function Button({
  variant = 'secondary',
  size = 'm',
  busy = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('btn', `btn--${variant}`, size === 's' && 'btn--s', className)}
      disabled={Boolean(disabled) || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}
