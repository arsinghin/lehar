import { lazy, Suspense, useState } from 'react';

import { Alert } from './components/Badge';
import { Icon } from './components/Icon';
import { NoticeProvider } from './components/Notice';
import { ThemeToggle } from './components/ThemeToggle';
import { createDemoPlan, createPlanState, DEMO_SCENARIOS, type DemoId } from './core/plan';
import type { EventProfile } from './core/schemas';
import { Home } from './features/home/Home';
import { Workspace } from './features/workspace/Workspace';
import { newId } from './lib/util';
import { nowIso, usePlanStore } from './state/PlanContext';

const IntakeWizard = lazy(() =>
  import('./features/intake/IntakeWizard').then((m) => ({ default: m.IntakeWizard })),
);

type View = 'home' | 'intake';

export function App() {
  const { state, dispatch, today, storageIssue } = usePlanStore();
  const [view, setView] = useState<View>('home');

  const openDemo = (id: DemoId) => {
    const plan = createDemoPlan(id, { id: newId(), now: nowIso(), today });
    const title = DEMO_SCENARIOS.find((demo) => demo.id === id)?.title ?? 'demo';
    dispatch({ type: 'plan/open', plan, reason: `Opened demo: ${title}`, at: nowIso() });
  };

  const create = (profile: EventProfile) => {
    dispatch({
      type: 'plan/open',
      plan: createPlanState(profile, { id: newId(), now: nowIso(), today }),
      reason: 'Created a new plan',
      at: nowIso(),
    });
    setView('home');
  };

  // Starting a new plan never discards the current one: it stays in History until replaced.
  const startNew = () => {
    setView('intake');
  };

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container site-header__inner">
          <button
            type="button"
            className="brand"
            aria-label="Lehar home"
            onClick={() => {
              setView('home');
            }}
          >
            <Icon name="logo" />
            Lehar
          </button>
          <ThemeToggle />
        </div>
      </header>
      <main id="main" className="container" tabIndex={-1}>
        <NoticeProvider>
          {storageIssue === 'unavailable' ? (
            <Alert tone="warn" title="Your browser is not saving this plan">
              <p>
                Storage is blocked, so the plan will be lost when you close this tab. Use “More →
                Save plan as a file”.
              </p>
            </Alert>
          ) : null}
          {storageIssue === 'invalid' ? (
            <Alert tone="warn" title="A saved plan could not be read">
              <p>It looked damaged, so Lehar started fresh to keep your data safe.</p>
            </Alert>
          ) : null}
          {view === 'intake' ? (
            <Suspense fallback={<p aria-busy="true">Loading…</p>}>
              <IntakeWizard
                today={today}
                onCreate={create}
                onCancel={() => {
                  setView('home');
                }}
              />
            </Suspense>
          ) : state.plan ? (
            <Workspace onNewPlan={startNew} />
          ) : (
            <Home
              onStart={() => {
                setView('intake');
              }}
              onDemo={openDemo}
            />
          )}
        </NoticeProvider>
      </main>
      <footer className="site-footer">
        <div className="container">
          <p>
            Lehar is open source (Apache-2.0), made by{' '}
            <a href="https://github.com/arsinghin/lehar" rel="noopener noreferrer">
              AR Singh (@arsinghin)
            </a>
            . Estimates are planning assumptions, not quotes. Your plan stays in this browser.
          </p>
        </div>
      </footer>
    </>
  );
}
