import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { toIdeaContext } from '../../core/aiContext';
import { IDEAS_PER_SET } from '../../core/constants/limits';
import { fetchIdeas } from '../../lib/aiActions';
import { useOpenPlan } from '../../state/PlanContext';
import { actions } from '../../state/store';
import { SourceBadge } from '../shared/StatusBadges';
import { useAiAction } from '../shared/useAiAction';
import { IdeaCard } from './IdeaCard';

const NEW_IDEAS = 'new';
const refineKey = (index: number) => `refine-${String(index)}`;

/** Personalised ideas from the AI (or built-in ones offline), each refinable in one click. */
export function IdeasView() {
  const { plan } = useOpenPlan();
  const ai = useAiAction();
  const ideas = plan.ideas;

  const suggest = () =>
    ai.run(NEW_IDEAS, {
      request: () => fetchIdeas(plan.profile),
      save: actions.setIdeas,
      success: 'Here are three ideas for your event.',
      failure: 'Could not get ideas right now.',
    });

  const refine = (index: number, ideaTitle: string, instruction: string) =>
    ai.run(refineKey(index), {
      request: () => fetchIdeas(plan.profile, { ideaTitle, instruction }),
      save: actions.setIdeas,
      success: `Refined: “${instruction}”.`,
      failure: 'Could not get ideas right now.',
    });

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
            busy={ai.pending === NEW_IDEAS}
            disabled={ai.pending !== null}
            onClick={() => void suggest()}
          >
            {ideas
              ? 'Start over with new ideas'
              : `Suggest ${String(IDEAS_PER_SET)} ideas for my event`}
          </Button>
        </div>
        {ideas?.refinedWith ? (
          <p className="small">Last refinement: “{ideas.refinedWith}”</p>
        ) : null}
      </section>

      {ideas ? (
        <ul className="idea-grid" aria-busy={ai.pending !== null}>
          {ideas.items.map((idea, index) => (
            <IdeaCard
              key={`${idea.title}-${String(index)}`}
              idea={idea}
              busy={ai.pending === refineKey(index)}
              disabled={ai.pending !== null}
              onRefine={(instruction) => void refine(index, idea.title, instruction)}
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
