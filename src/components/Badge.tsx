import type { ReactNode } from 'react';

import { cx } from '../lib/util';
import { Icon, type IconName } from './Icon';

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

export interface BadgeProps {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
}

/** A short status label. Color is never the only signal: the text always says it too. */
export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  return (
    <span className={cx('badge', `badge--${tone}`)}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </span>
  );
}
