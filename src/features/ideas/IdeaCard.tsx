import { useId } from 'react';

import { Badge } from '../../components/Badge';
import type { Idea } from '../../core/schemas';
import { COST_TEXT, COST_TONE } from './ideaLabels';
import { RefineControls } from './RefineControls';

const DETAILS = [
  { key: 'decor', label: 'Decor' },
  { key: 'food', label: 'Food' },
  { key: 'activity', label: 'Activity' },
] as const;

export interface IdeaCardProps {
  idea: Idea;
  busy: boolean;
  disabled: boolean;
  onRefine: (instruction: string) => void;
}

/** One concept: what it is, why it fits these guests, its relative cost, and ways to refine it. */
export function IdeaCard({ idea, busy, disabled, onRefine }: IdeaCardProps) {
  const headingId = useId();
  return (
    <li className="card idea" aria-labelledby={headingId}>
      <div className="card__title">
        <h3 id={headingId}>{idea.title}</h3>
        <Badge tone={COST_TONE[idea.costLevel]}>{COST_TEXT[idea.costLevel]}</Badge>
      </div>
      <p>{idea.summary}</p>
      <dl className="idea__details">
        {DETAILS.filter(({ key }) => idea[key]).map(({ key, label }) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{idea[key]}</dd>
          </div>
        ))}
      </dl>
      {idea.whyItFits ? (
        <p className="small">
          <strong>Why it fits:</strong> {idea.whyItFits}
        </p>
      ) : null}
      <RefineControls ideaTitle={idea.title} busy={busy} disabled={disabled} onRefine={onRefine} />
    </li>
  );
}
