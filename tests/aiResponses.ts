/** Canned AI service responses for the browser client tests. */
import { vi } from 'vitest';

export const IDEA = {
  title: 'Jungle',
  summary: 'A trail',
  decor: '',
  food: '',
  activity: '',
  whyItFits: '',
  costLevel: 'lower',
};

export function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  return vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status, headers })));
}

export const ok = (task: string, data: unknown, source = 'gemini') => ({
  ok: true,
  task,
  data,
  meta: { source, model: 'gemini-3.8-flash', cached: false, requestId: 'r' },
});

export const ideasRequest = {
  task: 'ideas' as const,
  context: {
    eventType: 'birthday' as const,
    guests: 30,
    tier: 'standard' as const,
    budgetBand: 'moderate' as const,
    month: 11,
    city: '',
    ageGroups: [],
    diets: [],
    accessNeeds: [],
    culture: '',
    mustHaves: [],
    topPriorities: [],
  },
};
