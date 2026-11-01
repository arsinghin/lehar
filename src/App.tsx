import { Suspense, useState } from 'react';

import { NoticeProvider } from './components/Notice';
import { PageLoading } from './components/PageLoading';
import { nowIso } from './core/dates';
import { createPlanState } from './core/plan';
import { createDemoPlan, DEMO_SCENARIOS, type DemoId } from './core/demo';
import type { EventProfile } from './core/schemas';
import { Home } from './features/home/Home';
import { SiteFooter } from './features/layout/SiteFooter';
import { SiteHeader } from './features/layout/SiteHeader';
import { StorageWarnings } from './features/layout/StorageWarnings';
import { Workspace } from './features/workspace/Workspace';
import { lazyNamed } from './lib/lazyNamed';
import { newId } from './lib/util';
import { usePlanStore } from './state/PlanContext';
import { actions } from './state/store';

const IntakeWizard = lazyNamed(() => import('./features/intake/IntakeWizard'), 'IntakeWizard');

type View = 'home' | 'intake' | 'plan';

/** Top-level navigation between the home page, the intake wizard and the open plan. */
export function App() {
  const { state, dispatch, today, storageIssue } = usePlanStore();
  // A saved plan opens straight into the workspace; the logo always leads back to the home page.
  const [view, setView] = useState<View>(state.plan ? 'plan' : 'home');
  const newPlanOptions = () => ({ id: newId(), now: nowIso(), today });

  const openDemo = (id: DemoId) => {
    const title = DEMO_SCENARIOS.find((demo) => demo.id === id)?.title ?? 'demo';
    dispatch(actions.openPlan(createDemoPlan(id, newPlanOptions()), `Opened demo: ${title}`));
    setView('plan');
  };

  // Starting a new plan never discards the current one: it stays in History until replaced.
  const create = (profile: EventProfile) => {
    dispatch(actions.openPlan(createPlanState(profile, newPlanOptions()), 'Created a new plan'));
    setView('plan');
  };

  const showPlanOrHome = () => {
    setView(state.plan ? 'plan' : 'home');
  };
  // Without an open plan, "plan" falls back to the home page.
  const screen: View = view === 'plan' && !state.plan ? 'home' : view;

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader
        onHome={() => {
          setView('home');
        }}
      />
      <main id="main" className="container" tabIndex={-1}>
        <NoticeProvider>
          <StorageWarnings issue={storageIssue} />
          {screen === 'intake' ? (
            <Suspense fallback={<PageLoading />}>
              <IntakeWizard today={today} onCreate={create} onCancel={showPlanOrHome} />
            </Suspense>
          ) : null}
          {screen === 'plan' ? (
            <Workspace
              onNewPlan={() => {
                setView('intake');
              }}
            />
          ) : null}
          {screen === 'home' ? (
            <Home
              onStart={() => {
                setView('intake');
              }}
              onDemo={openDemo}
              continuePlan={
                state.plan ? { title: state.plan.profile.title, onContinue: showPlanOrHome } : null
              }
            />
          ) : null}
        </NoticeProvider>
      </main>
      <SiteFooter />
    </>
  );
}
