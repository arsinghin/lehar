import { useState } from 'react';

import { Alert, Badge, SourceBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Field';
import { useNotify } from '../../components/Notice';
import { toIdeaContext } from '../../core/aiContext';
import { LIMITS } from '../../core/constants/limits';
import type { Idea } from '../../core/schemas';
import { AiInputError, fetchIdeas } from '../../lib/aiActions';
import { useOpenPlan } from '../../state/PlanContext';

const REFINEMENTS = [
  { label: 'Cheaper', instruction: 'Make it cheaper without losing the feel' },
  { label: 'Kid-friendly', instruction: 'Make it work well for young children' },
  { label: 'Elder-friendly', instruction: 'Make it comfortable for elderly family members' },
  { label: 'More traditional', instruction: 'Make it more traditional' },
  { label: 'Eco-friendly', instruction: 'Make it eco-friendly and low-waste' },
] as const;

const COST_TEXT = { lower: 'Lower cost', similar: 'Similar cost', higher: 'Higher cost' } as const;

export function IdeasView() {
  const { plan, dispatch } = useOpenPlan();
  const notify = useNotify();
  const [busy, setBusy] = useState<string | null>(null);
  const ideas = plan.ideas;

  const run = async (key: string, refine?: { ideaTitle: string; instruction: string }) => {
    setBusy(key);
    try {
      const outcome = await fetchIdeas(plan.profile, refine);
      dispatch({ type: 'ideas/set', ideas: outcome.value });
      notify(
        outcome.notice
          ? { tone: 'info', text: outcome.notice }
          : {
              tone: 'ok',
              text: refine
                ? `Refined: “${refine.instruction}”.`
                : 'Here are three ideas for your event.',
            },
      );
    } catch (error) {
      notify({
        tone: 'danger',
        text: error instanceof AiInputError ? error.message : 'Could not get ideas right now.',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stack-l">
      <section className="stack" aria-labelledby="ideas-title">
        <div className="card__title">
          <h2 id="ideas-title">Personalised ideas</h2>
          {ideas ? <SourceBadge source={ideas.source} /> : null}
        </div>
        <p className="muted">
          Concepts shaped by your guests’ ages, diets, accessibility needs, culture, must-haves and
          budget feel. Like one but it is too expensive, or not right for grandparents? Say so and
          Lehar adapts it.
        </p>
        <div className="row">
          <Button
            variant={ideas ? 'secondary' : 'primary'}
            icon="sparkle"
            busy={busy === 'new'}
            disabled={busy !== null}
            onClick={() => void run('new')}
          >
            {ideas ? 'Start over with new ideas' : 'Suggest 3 ideas for my event'}
          </Button>
        </div>
        {ideas?.refinedWith ? (
          <p className="small">Last refinement: “{ideas.refinedWith}”</p>
        ) : null}
      </section>

      {ideas ? (
        <ul className="idea-grid" aria-busy={busy !== null}>
          {ideas.items.map((idea, index) => (
            <IdeaCard
              key={`${idea.title}-${String(index)}`}
              idea={idea}
              index={index}
              busyKey={busy}
              onRefine={(instruction) =>
                void run(`refine-${String(index)}`, { ideaTitle: idea.title, instruction })
              }
            />
          ))}
        </ul>
      ) : null}

      <details className="details">
        <summary>What Lehar sends to the AI</summary>
        <p className="small">
          Only this. No names, notes, phone numbers or exact budget. The AI is told never to quote
          prices or name vendors, and its answers are checked before you see them.
        </p>
        <pre className="code">{JSON.stringify(toIdeaContext(plan.profile), null, 2)}</pre>
      </details>

      {!ideas ? (
        <Alert tone="info">
          <p>
            Ideas are suggestions to spark your thinking. Your plan’s budget and timeline never
            depend on them.
          </p>
        </Alert>
      ) : null}
    </div>
  );
}

function IdeaCard({
  idea,
  index,
  busyKey,
  onRefine,
}: {
  idea: Idea;
  index: number;
  busyKey: string | null;
  onRefine: (instruction: string) => void;
}) {
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | undefined>();
  const headingId = `idea-${String(index)}`;
  const busy = busyKey === `refine-${String(index)}`;

  return (
    <li className="card idea" aria-labelledby={headingId}>
      <div className="card__title">
        <h3 id={headingId}>{idea.title}</h3>
        <Badge
          tone={
            idea.costLevel === 'lower' ? 'ok' : idea.costLevel === 'higher' ? 'warn' : 'neutral'
          }
        >
          {COST_TEXT[idea.costLevel]}
        </Badge>
      </div>
      <p>{idea.summary}</p>
      <dl className="idea__details">
        {idea.decor ? (
          <div>
            <dt>Decor</dt>
            <dd>{idea.decor}</dd>
          </div>
        ) : null}
        {idea.food ? (
          <div>
            <dt>Food</dt>
            <dd>{idea.food}</dd>
          </div>
        ) : null}
        {idea.activity ? (
          <div>
            <dt>Activity</dt>
            <dd>{idea.activity}</dd>
          </div>
        ) : null}
      </dl>
      {idea.whyItFits ? (
        <p className="small">
          <strong>Why it fits:</strong> {idea.whyItFits}
        </p>
      ) : null}
      <fieldset className="refine">
        <legend className="small">Refine “{idea.title}”</legend>
        <div className="row">
          {REFINEMENTS.map((item) => (
            <button
              key={item.label}
              type="button"
              className="chip"
              disabled={busyKey !== null}
              onClick={() => {
                onRefine(item.instruction);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <form
          className="row refine__custom"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const text = custom.trim();
            if (text.length < 2) {
              setError('Describe what you would like to change.');
              return;
            }
            setError(undefined);
            onRefine(text);
          }}
        >
          <TextField
            label="Or say what to change"
            hideLabel
            placeholder="For example: we have no stage, keep it outdoors"
            maxLength={LIMITS.maxRefineText}
            value={custom}
            error={error}
            onChange={(event) => {
              setCustom(event.target.value);
            }}
          />
          <Button
            aria-label={`Refine ${idea.title}`}
            type="submit"
            size="s"
            busy={busy}
            disabled={busyKey !== null}
          >
            Refine
          </Button>
        </form>
      </fieldset>
    </li>
  );
}
