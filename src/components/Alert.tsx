import type { ReactNode } from 'react';

import { cx } from '../lib/util';
import type { Tone } from './Badge';
import { Icon, type IconName } from './Icon';

export type AlertTone = Exclude<Tone, 'neutral'>;

const ALERT_ICON: Record<AlertTone, IconName> = {
  ok: 'check',
  warn: 'alert',
  danger: 'alert',
  info: 'info',
};

export interface AlertProps {
  tone: AlertTone;
  title?: string;
  children?: ReactNode;
  role?: 'alert' | 'status';
}

/** A boxed message with an icon and an optional bold title. */
export function Alert({ tone, title, children, role }: AlertProps) {
  return (
    <div className={cx('alert', `alert--${tone}`)} role={role}>
      <Icon name={ALERT_ICON[tone]} />
      <div className="alert__body">
        {title ? (
          <p>
            <strong>{title}</strong>
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
