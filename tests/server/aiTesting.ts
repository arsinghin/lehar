/** Shared requests, fake providers and handler wiring for the AI gateway tests. */
import { vi } from 'vitest';

import { CircuitBreaker } from '../../server/ai/breaker';
import type { HandlerDeps } from '../../server/ai/handler';
import type { AiProvider } from '../../server/ai/providers/types';
import { TtlCache } from '../../server/cache';
import { loadConfig } from '../../server/config';
import { silentLogger } from '../../server/log';
import { RateLimiter } from '../../server/security/rateLimit';

export const ORIGIN = 'https://lehar.vercel.app';

export const IDEAS_REQUEST = {
  task: 'ideas' as const,
  context: {
    eventType: 'birthday' as const,
    guests: 30,
    tier: 'standard' as const,
    budgetBand: 'moderate' as const,
    month: 11,
    city: 'Pune',
    ageGroups: ['kids' as const],
    diets: ['veg' as const],
    accessNeeds: [],
    culture: '',
    mustHaves: ['Nut-free cake'],
    topPriorities: ['catering' as const],
  },
};

export const CHANGE_REQUEST = {
  task: 'parseChange' as const,
  text: 'make the party feel smaller',
  context: {
    eventType: 'wedding' as const,
    guests: 200,
    budget: 800_000,
    eventDate: '2027-02-23',
    today: '2026-10-26',
  },
};

export const VALID_IDEAS = JSON.stringify({
  ideas: [
    {
      title: 'Jungle explorer',
      summary: 'A safari trail with missions. Book at www.example.com for ₹5,000!',
      decor: 'Paper leaves',
      food: 'Veg snacks',
      activity: 'Treasure hunt',
      whyItFits: 'Keeps kids busy',
      costLevel: 'lower',
    },
  ],
});

export function fakeProvider(
  id: string,
  impl: () => Promise<string>,
  source: AiProvider['source'] = 'gemini',
): AiProvider {
  return { id, source, model: id, generate: vi.fn(impl) };
}

export function deps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    config: loadConfig({}),
    providers: [],
    cache: new TtlCache(50, 60_000),
    limiter: new RateLimiter({ perMinute: 100, perDay: 1000 }),
    breaker: new CircuitBreaker(),
    logger: silentLogger,
    randomId: () => 'req-1',
    ...overrides,
  };
}

export function post(
  body: unknown,
  init: { headers?: Record<string, string>; raw?: string; method?: string } = {},
): Request {
  return new Request(`${ORIGIN}/api/ai`, {
    method: init.method ?? 'POST',
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      'sec-fetch-site': 'same-origin',
      ...init.headers,
    },
    ...(init.method === 'GET' ? {} : { body: init.raw ?? JSON.stringify(body) }),
  });
}

export async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}
