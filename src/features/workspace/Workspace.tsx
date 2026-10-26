import { lazy, Suspense, useRef, useState, type ChangeEvent } from 'react';

import { Badge, BudgetStatusBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useNotify } from '../../components/Notice';
import { TabPanel, Tabs } from '../../components/Tabs';
import { EVENT_TYPE_LABELS } from '../../core/constants/enums';
import { formatDateLong } from '../../core/dates';
import { formatInr } from '../../core/money';
import { CHANGE_TEST_TEXT } from '../../core/plan';
import { displayTitle } from '../../core/profile';
import { downloadText, slugify } from '../../lib/util';
import { nowIso, useOpenPlan } from '../../state/PlanContext';
import { parsePlanFile } from '../../state/persistence';
import { BudgetView } from '../budget/BudgetView';
import { ChangeDialog } from '../changes/ChangeDialog';
import { Overview } from '../overview/Overview';
import { exportIcs } from '../timeline/exportIcs';
import { PrintSummary } from './PrintSummary';
import { TAB_LABELS, WORKSPACE_TABS, type WorkspaceTab } from './tabs';

// Less-used screens load on demand to keep the first load small.
const TimelineView = lazy(() =>
  import('../timeline/TimelineView').then((m) => ({ default: m.TimelineView })),
);
const VendorsView = lazy(() =>
  import('../vendors/VendorsView').then((m) => ({ default: m.VendorsView })),
);
const IdeasView = lazy(() => import('../ideas/IdeasView').then((m) => ({ default: m.IdeasView })));
const HistoryView = lazy(() =>
  import('../history/HistoryView').then((m) => ({ default: m.HistoryView })),
);

const ID_PREFIX = 'ws';

export function Workspace({ onNewPlan }: { onNewPlan: () => void }) {
  const { plan, derived, state, dispatch } = useOpenPlan();
  const notify = useNotify();
  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeText, setChangeText] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const { budget, schedule } = derived;
  const title = displayTitle(plan.profile);

  const openChange = (text: string) => {
    setChangeText(text);
    setChangeOpen(true);
  };

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const result = parsePlanFile(await file.text());
    if (!result.ok) {
      notify({ tone: 'danger', text: result.message });
      return;
    }
    dispatch({
      type: 'plan/open',
      plan: result.plan,
      reason: `Loaded plan from ${file.name.slice(0, 60)}`,
      at: nowIso(),
    });
    notify({ tone: 'ok', text: 'Plan loaded. Your previous plan is in History.' });
  };

  const tabItems = WORKSPACE_TABS.map((id) => ({
    id,
    label: TAB_LABELS[id],
    count:
      id === 'timeline'
        ? schedule.counts.overdue
        : id === 'budget' && budget.gap > 0
          ? 1
          : undefined,
    countLabel: id === 'timeline' ? 'overdue tasks' : 'over budget',
  }));

  return (
    <div className="workspace">
      <header className="ws-header card">
        <div className="ws-header__title">
          <p className="hero__eyebrow">
            {EVENT_TYPE_LABELS[plan.profile.eventType]}
            {plan.isDemo ? (
              <>
                {' '}
                <Badge tone="info">Demo</Badge>
              </>
            ) : null}
          </p>
          <h1 className="ws-title">{title}</h1>
          <p className="muted">
            {formatDateLong(plan.profile.eventDate)} · {schedule.daysLeft} days to go ·{' '}
            {plan.profile.guests.toLocaleString('en-IN')} guests · {formatInr(plan.profile.budget)}{' '}
            <BudgetStatusBadge status={budget.status} />
          </p>
        </div>
        <div className="ws-header__actions row">
          <Button
            variant="primary"
            icon="ripple"
            onClick={() => {
              openChange('');
            }}
          >
            Something changed?
          </Button>
          <Button
            icon="undo"
            disabled={state.past.length === 0}
            onClick={() => {
              dispatch({ type: 'history/undo' });
            }}
          >
            Undo
          </Button>
          <Button
            icon="redo"
            disabled={state.future.length === 0}
            onClick={() => {
              dispatch({ type: 'history/redo' });
            }}
          >
            Redo
          </Button>
          <details className="menu">
            <summary className="btn btn--ghost">
              <Icon name="menu" /> More
            </summary>
            <div className="menu__panel">
              <Button
                variant="ghost"
                icon="calendar"
                onClick={() => {
                  exportIcs(title, plan.profile.eventDate, schedule.tasks);
                }}
              >
                Export calendar (.ics)
              </Button>
              <Button
                variant="ghost"
                icon="download"
                onClick={() => {
                  downloadText(
                    `${slugify(title)}.lehar.json`,
                    JSON.stringify(plan, null, 2),
                    'application/json',
                  );
                }}
              >
                Save plan as a file
              </Button>
              <Button variant="ghost" icon="upload" onClick={() => fileInput.current?.click()}>
                Load a plan file
              </Button>
              <Button
                variant="ghost"
                icon="printer"
                onClick={() => {
                  window.print();
                }}
              >
                Print or save as PDF
              </Button>
              <Button variant="ghost" icon="plus" onClick={onNewPlan}>
                Start a new plan
              </Button>
            </div>
          </details>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            tabIndex={-1}
            aria-label="Load a plan file"
            onChange={(event) => void onImport(event)}
          />
        </div>
      </header>

      <Tabs
        label="Plan sections"
        items={tabItems}
        active={tab}
        onChange={setTab}
        idPrefix={ID_PREFIX}
      />
      <TabPanel idPrefix={ID_PREFIX} id={tab}>
        <Suspense fallback={<p aria-busy="true">Loading…</p>}>
          {tab === 'overview' ? (
            <Overview
              onNavigate={setTab}
              onChangeTest={() => {
                openChange(CHANGE_TEST_TEXT);
              }}
            />
          ) : null}
          {tab === 'budget' ? <BudgetView /> : null}
          {tab === 'timeline' ? <TimelineView /> : null}
          {tab === 'vendors' ? <VendorsView /> : null}
          {tab === 'ideas' ? <IdeasView /> : null}
          {tab === 'history' ? <HistoryView /> : null}
        </Suspense>
      </TabPanel>

      <ChangeDialog
        open={changeOpen}
        initialText={changeText}
        onClose={() => {
          setChangeOpen(false);
        }}
      />
      <PrintSummary />
    </div>
  );
}
