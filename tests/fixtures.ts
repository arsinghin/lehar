import { createProfile, type ProfileSeed } from '../src/core/profile';
import type { EventProfile, PlanState, Quote } from '../src/core/schemas';
import { createPlanState } from '../src/core/plan';

export const TODAY = '2026-10-26';

export function profile(
  overrides: Partial<EventProfile> = {},
  seed: Partial<ProfileSeed> = {},
): EventProfile {
  return {
    ...createProfile({
      eventType: 'wedding',
      eventDate: '2027-02-23',
      guests: 200,
      budget: 800_000,
      ...seed,
    }),
    ...overrides,
  };
}

export function plan(
  overrides: Partial<PlanState> = {},
  profileOverrides: Partial<EventProfile> = {},
): PlanState {
  return {
    ...createPlanState(profile(profileOverrides), {
      id: 'plan-1',
      now: '2026-10-26T10:00:00.000Z',
      today: TODAY,
    }),
    ...overrides,
  };
}

export function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'q1',
    category: 'catering',
    vendorLabel: 'Caterer A',
    amount: 230_000,
    guestsCovered: 200,
    inclusions: [],
    notes: '',
    status: 'received',
    ...overrides,
  };
}
