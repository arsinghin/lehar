/** Ready-made demo plans, each built relative to today so their dates never go stale. */
import type { AccessNeed, AgeGroup, Diet, EventType } from './constants/enums.js';
import { addDays } from './dates.js';
import { createPlanState, type NewPlanOptions } from './plan.js';
import { createProfile } from './profile.js';
import type { EventProfile, PlanState, Quote, TaskProgress } from './schemas.js';

export type DemoId = 'wedding' | 'over-budget' | 'kids-birthday' | 'society-mela';

export interface DemoScenario {
  id: DemoId;
  title: string;
  description: string;
}

export const DEMO_SCENARIOS: readonly DemoScenario[] = [
  {
    id: 'wedding',
    title: 'A wedding, 4 months away',
    description: '₹8,00,000 · 200 guests · Pune. Try a sample change on it.',
  },
  {
    id: 'over-budget',
    title: 'Same wedding, 20% over budget',
    description: 'See trade-offs ranked by what matters to the family, with no blind cuts.',
  },
  {
    id: 'kids-birthday',
    title: 'A 6th birthday party',
    description: '30 guests, mostly kids · ₹60,000 · 1 month away.',
  },
  {
    id: 'society-mela',
    title: 'A society Diwali mela',
    description: '300 residents · ₹2,10,000 · volunteers, permissions and safety.',
  },
];

/** A sample change that moves guests, budget and date at once. */
export const SAMPLE_CHANGE_TEXT =
  'We now have 50 more guests, our budget is down by 10%, and the event is happening 2 weeks earlier.';

const SAMPLE_QUOTES: Quote[] = [
  {
    id: 'demo-caterer-a',
    category: 'catering',
    vendorLabel: 'Caterer A (sample)',
    amount: 2_30_000,
    guestsCovered: 200,
    inclusions: ['GST / taxes', 'Service staff', 'Crockery & cutlery', 'Tasting session'],
    notes: 'Sample quote so you can try the comparison.',
    status: 'shortlisted',
  },
  {
    id: 'demo-caterer-b',
    category: 'catering',
    vendorLabel: 'Caterer B (sample)',
    amount: 2_05_000,
    guestsCovered: 180,
    inclusions: ['Service staff', 'Crockery & cutlery'],
    notes: 'Cheaper, but check what is missing.',
    status: 'received',
  },
];

interface DemoSeed {
  eventType: EventType;
  daysAway: number;
  guests: number;
  budget: number;
  title: string;
  city: string;
  details: Partial<
    Pick<EventProfile, 'protectedCategories' | 'culture' | 'mustHaves'> & {
      ageGroups: AgeGroup[];
      diets: Diet[];
      accessNeeds: AccessNeed[];
    }
  >;
  progress?: Record<string, TaskProgress>;
  quotes?: Quote[];
}

const WEDDING: Omit<DemoSeed, 'budget'> = {
  eventType: 'wedding',
  daysAway: 120,
  guests: 200,
  title: 'Riya & Arjun’s wedding',
  city: 'Pune',
  details: {
    ageGroups: ['kids', 'adults', 'seniors'],
    diets: ['veg', 'jain'],
    protectedCategories: ['catering'],
    culture: 'Marathi Hindu',
    mustHaves: ['Pure-veg menu with Jain options', 'Live dhol for the baraat'],
  },
  progress: {
    'fix-date': { done: true, delayDays: 0 },
    'guest-draft': { done: true, delayDays: 0 },
  },
  quotes: SAMPLE_QUOTES,
};

const DEMO_SEEDS: Record<DemoId, DemoSeed> = {
  wedding: { ...WEDDING, budget: 8_00_000 },
  // The same wedding on a budget about 20% short of the estimate.
  'over-budget': { ...WEDDING, budget: 6_65_000 },
  'kids-birthday': {
    eventType: 'birthday',
    daysAway: 30,
    guests: 30,
    budget: 60_000,
    title: 'Aarav turns 6',
    city: 'Bengaluru',
    details: { ageGroups: ['kids', 'adults'], diets: ['veg'], mustHaves: ['Nut-free cake'] },
  },
  'society-mela': {
    eventType: 'community',
    daysAway: 60,
    guests: 300,
    budget: 2_10_000,
    title: 'Green Meadows Diwali Mela',
    city: 'Hyderabad',
    details: {
      ageGroups: ['kids', 'teens', 'adults', 'seniors'],
      diets: ['veg'],
      accessNeeds: ['wheelchair'],
      mustHaves: ['Eco-friendly, no firecrackers', 'Rangoli competition'],
    },
  },
};

/** Builds a ready-to-explore demo plan relative to today. */
export function createDemoPlan(id: DemoId, options: Omit<NewPlanOptions, 'isDemo'>): PlanState {
  const seed = DEMO_SEEDS[id];
  const profile: EventProfile = {
    ...createProfile({
      eventType: seed.eventType,
      eventDate: addDays(options.today, seed.daysAway),
      guests: seed.guests,
      budget: seed.budget,
      title: seed.title,
      city: seed.city,
    }),
    ...seed.details,
  };
  return {
    ...createPlanState(profile, { ...options, isDemo: true }),
    progress: { ...seed.progress },
    quotes: [...(seed.quotes ?? [])],
  };
}
