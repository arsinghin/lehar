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
