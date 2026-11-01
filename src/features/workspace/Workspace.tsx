import { Suspense, useState } from 'react';

import { PageLoading } from '../../components/PageLoading';
import { TabPanel, Tabs } from '../../components/Tabs';
import { SAMPLE_CHANGE_TEXT } from '../../core/demo';
import { displayTitle } from '../../core/profile';
import { lazyNamed } from '../../lib/lazyNamed';
import { useOpenPlan } from '../../state/PlanContext';
import { BudgetView } from '../budget/BudgetView';
import { ChangeDialog } from '../changes/ChangeDialog';
import { Overview } from '../overview/Overview';
import { PrintSummary } from './PrintSummary';
import { workspaceTabs, type WorkspaceTab } from './tabs';
import { WorkspaceHeader } from './WorkspaceHeader';

// Less-used screens load on demand to keep the first load small.
const TimelineView = lazyNamed(() => import('../timeline/TimelineView'), 'TimelineView');
const VendorsView = lazyNamed(() => import('../vendors/VendorsView'), 'VendorsView');
const IdeasView = lazyNamed(() => import('../ideas/IdeasView'), 'IdeasView');
const HistoryView = lazyNamed(() => import('../history/HistoryView'), 'HistoryView');

const ID_PREFIX = 'ws';

export interface WorkspaceProps {
  onNewPlan: () => void;
}

/** The open plan: header, tabs for each part of the plan, and the "Something changed?" dialog. */
export function Workspace({ onNewPlan }: WorkspaceProps) {
  const { plan, derived } = useOpenPlan();
  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [change, setChange] = useState<{ open: boolean; text: string }>({ open: false, text: '' });
  const title = displayTitle(plan.profile);

  const openChange = (text: string) => {
    setChange({ open: true, text });
  };

  return (
    <div className="workspace">
      <WorkspaceHeader
        title={title}
        onSomethingChanged={() => {
          openChange('');
        }}
        onNewPlan={onNewPlan}
      />
      <Tabs
        label="Plan sections"
        items={workspaceTabs(derived)}
        active={tab}
        onChange={setTab}
        idPrefix={ID_PREFIX}
      />
      <TabPanel idPrefix={ID_PREFIX} id={tab}>
        <Suspense fallback={<PageLoading />}>
          {tab === 'overview' ? (
            <Overview
              onNavigate={setTab}
              onSampleChange={() => {
                openChange(SAMPLE_CHANGE_TEXT);
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
        open={change.open}
        initialText={change.text}
        onClose={() => {
          setChange((current) => ({ ...current, open: false }));
        }}
      />
      <PrintSummary />
    </div>
  );
}
