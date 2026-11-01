/** Badges that describe the plan itself: budget status and where an AI suggestion came from. */
import { Badge, type Tone } from '../../components/Badge';
import type { BudgetStatus } from '../../core/budget';
import type { AiSource } from '../../core/constants/enums';

const STATUS_TEXT: Record<BudgetStatus, string> = {
  within: 'Within budget',
  tight: 'Tight: under 5% left',
  over: 'Over budget',
};

const STATUS_TONE: Record<BudgetStatus, Tone> = {
  within: 'ok',
  tight: 'warn',
  over: 'danger',
};

/** Within budget, tight or over, as a badge. */
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
