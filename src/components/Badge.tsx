import type { ReactNode } from 'react';

import type { AiSource } from '../core/constants/enums';
import type { BudgetStatus } from '../core/budget';
import { cx } from '../lib/util';
import { Icon, type IconName } from './Icon';

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

export function Badge({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <span className={cx('badge', `badge--${tone}`)}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </span>
  );
}

const ALERT_ICON: Record<Exclude<Tone, 'neutral'>, IconName> = {
  ok: 'check',
  warn: 'alert',
  danger: 'alert',
  info: 'info',
};

export function Alert({
  tone,
  title,
  children,
  role,
}: {
  tone: Exclude<Tone, 'neutral'>;
  title?: string;
  children?: ReactNode;
  role?: 'alert' | 'status';
}) {
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

export const STATUS_TEXT: Record<BudgetStatus, string> = {
  within: 'Within budget',
  tight: 'Tight: under 5% left',
  over: 'Over budget',
};

export const STATUS_TONE: Record<BudgetStatus, Tone> = {
  within: 'ok',
  tight: 'warn',
  over: 'danger',
};

export function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} icon={status === 'within' ? 'check' : 'alert'}>
      {STATUS_TEXT[status]}
    </Badge>
  );
}

const SOURCE_NAMES = {
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
  nvidia: 'NVIDIA NIM',
} as const satisfies Record<Exclude<AiSource, 'rules'>, string>;

/** Says where a suggestion came from, so AI output is never mistaken for verified facts. */
export function SourceBadge({ source }: { source: AiSource }) {
  if (source === 'rules') {
    return (
      <Badge tone="neutral" icon="rules">
        Built-in suggestion
      </Badge>
    );
  }
  return (
    <Badge tone="info" icon="sparkle">
      AI suggestion · {SOURCE_NAMES[source]}
    </Badge>
  );
}
