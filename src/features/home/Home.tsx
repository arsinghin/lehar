import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { DEMO_SCENARIOS, type DemoId } from '../../core/demo';

export interface ContinuePlan {
  /** The open plan's name; empty for an untitled plan. */
  title: string;
  onContinue: () => void;
}

export interface HomeProps {
  onStart: () => void;
  onDemo: (id: DemoId) => void;
  /** Present when a plan is already open, so the host can go straight back to it. */
  continuePlan: ContinuePlan | null;
}

/** The landing page: what Lehar does, how it works, ready-made demos and its promises. */
export function Home({ onStart, onDemo, continuePlan }: HomeProps) {
  return (
    <div className="stack-l">
      <section className="hero" aria-labelledby="hero-title">
        <p className="hero__eyebrow">Weddings · Birthdays · Community events</p>
        <h1 id="hero-title">
          Plan the celebration.
          <br />
          <span className="hero__accent">Lehar handles the ripples.</span>
        </h1>
        <p className="lead">
          Budget, timeline, vendors and ideas in one plan built around your guests, your money and
          your date. When something changes, like more guests, a smaller budget or an earlier date,
          Lehar shows exactly how it ripples through everything. Then <strong>you</strong> decide.
        </p>
        <div className="row">
          {continuePlan ? (
            <Button variant="primary" icon="ripple" onClick={continuePlan.onContinue}>
              {continuePlan.title ? `Continue ${continuePlan.title}` : 'Continue your plan'}
            </Button>
          ) : null}
          <Button variant={continuePlan ? 'secondary' : 'primary'} icon="plus" onClick={onStart}>
            Start a new plan
          </Button>
          <a className="btn btn--ghost" href="#demos">
            Explore an example
          </a>
        </div>
      </section>

      <HowItWorks />

      <DemoList onDemo={onDemo} />

      <HonestByDesign />
    </div>
  );
}

function HowItWorks() {
  return (
    <section aria-labelledby="how-title">
      <h2 id="how-title">How Lehar works</h2>
      <ol className="how">
        <li className="card card--flat">
          <h3>1. Tell it about your event</h3>
          <p>Occasion, date, guests, budget, what matters most and what must never be cut.</p>
        </li>
        <li className="card card--flat">
          <h3>2. Get a plan you can run</h3>
          <p>
            A category budget that adds up exactly, a dated task list in the right order, vendor
            checklists and ideas that fit your guests.
          </p>
        </li>
        <li className="card card--flat">
          <h3>3. Change anything, see every ripple</h3>
          <p>
            Type “50 more guests and 2 weeks earlier”. Preview the impact, then apply it or undo it.
            Nothing changes without you.
          </p>
        </li>
      </ol>
    </section>
  );
}

function DemoList({ onDemo }: Pick<HomeProps, 'onDemo'>) {
  return (
    <section id="demos" aria-labelledby="demos-title" tabIndex={-1}>
      <h2 id="demos-title">Try a ready-made plan</h2>
      <ul className="demo-grid">
        {DEMO_SCENARIOS.map((demo) => (
          <li key={demo.id}>
            <button
              type="button"
              className="demo-card"
              onClick={() => {
                onDemo(demo.id);
              }}
            >
              <span className="demo-card__title">{demo.title}</span>
              <span className="demo-card__desc">{demo.description}</span>
              <span className="demo-card__cta">
                Open <Icon name="ripple" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HonestByDesign() {
  return (
    <section className="card card--flat" aria-labelledby="trust-title">
      <h2 id="trust-title">Honest by design</h2>
      <ul className="trust">
        <li>
          <strong>Numbers come from code, not AI.</strong> Every rupee and every date is calculated
          by tested rules, and every estimate is labelled as an assumption you can edit.
        </li>
        <li>
          <strong>AI personalises; it never invents.</strong> Google Gemini suggests ideas and
          vendor questions and reads your changes. It is never allowed to quote prices or name
          vendors.
        </li>
        <li>
          <strong>Private.</strong> Your plan stays in this browser. The AI only sees what it needs:
          no names, notes, phone numbers or exact budget.
        </li>
      </ul>
    </section>
  );
}
