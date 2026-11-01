import type { DerivedPlan } from '../../core/plan';
import type { TabItem } from '../../components/Tabs';

export const WORKSPACE_TABS = [
  'overview',
  'budget',
  'timeline',
  'vendors',
  'ideas',
  'history',
] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

export const TAB_LABELS: Record<WorkspaceTab, string> = {
  overview: 'Overview',
  budget: 'Budget',
  timeline: 'Timeline',
  vendors: 'Vendors',
  ideas: 'Ideas',
  history: 'History',
};

/** The red count on a tab: overdue tasks on Timeline, and a single flag when over budget. */
function badgeFor(
  id: WorkspaceTab,
  derived: DerivedPlan,
): Pick<TabItem<WorkspaceTab>, 'count' | 'countLabel'> {
  if (id === 'timeline' && derived.schedule.counts.overdue > 0) {
    return { count: derived.schedule.counts.overdue, countLabel: 'overdue tasks' };
  }
  if (id === 'budget' && derived.budget.gap > 0) return { count: 1, countLabel: 'over budget' };
  return {};
}

/** The workspace tabs with their current counts. */
export function workspaceTabs(derived: DerivedPlan): TabItem<WorkspaceTab>[] {
  return WORKSPACE_TABS.map((id) => ({ id, label: TAB_LABELS[id], ...badgeFor(id, derived) }));
}
