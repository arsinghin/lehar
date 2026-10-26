/** Plan lifecycle helpers and the derived view model used by the UI. */
import { estimateBudget, type BudgetSummary } from './budget.js';
import { addDays, type IsoDate } from './dates.js';
import { createProfile, type ProfilePatch, applyProfilePatch } from './profile.js';
import { analyzeTradeoffs, type TradeoffAnalysis } from './tradeoffs.js';
import { buildSchedule, type Schedule } from './timeline.js';
import { vendorBrief, type VendorBrief } from './vendors.js';
import type { EventProfile, PlanState, Quote } from './schemas.js';

export interface DerivedPlan {
  budget: BudgetSummary;
  schedule: Schedule;
  tradeoffs: TradeoffAnalysis;
  vendorBriefs: VendorBrief[];
}

export interface NewPlanOptions {
  id: string;
  now: string;
  today: IsoDate;
  isDemo?: boolean;
}

export function createPlanState(profile: EventProfile, options: NewPlanOptions): PlanState {
  return {
    schemaVersion: 1,
    id: options.id,
    createdAt: options.now,
    startDate: options.today,
    isDemo: options.isDemo ?? false,
    profile,
    progress: {},
    quotes: [],
    ideas: null,
    vendorQuestions: {},
  };
}

export function withProfilePatch(plan: PlanState, patch: ProfilePatch): PlanState {
  return { ...plan, profile: applyProfilePatch(plan.profile, patch) };
}

export function derivePlan(plan: PlanState, today: IsoDate): DerivedPlan {
  const budget = estimateBudget(plan.profile, plan.quotes);
  const schedule = buildSchedule({
    eventType: plan.profile.eventType,
    eventDate: plan.profile.eventDate,
    startDate: plan.startDate,
    progress: plan.progress,
    today,
  });
  const vendorBriefs = budget.lines
    .map((line) => vendorBrief(plan.profile, line))
    .filter((brief): brief is VendorBrief => brief !== null);
  return { budget, schedule, tradeoffs: analyzeTradeoffs(plan.profile, plan.quotes), vendorBriefs };
}

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

const demoQuotes: Quote[] = [
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

/** Builds a ready-to-explore demo plan relative to today, so dates never go stale. */
export function createDemoPlan(id: DemoId, options: Omit<NewPlanOptions, 'isDemo'>): PlanState {
  const { today } = options;
  const base = { ...options, isDemo: true };
  switch (id) {
    case 'wedding':
    case 'over-budget': {
      const profile: EventProfile = {
        ...createProfile({
          eventType: 'wedding',
          eventDate: addDays(today, 120),
          guests: 200,
          budget: id === 'wedding' ? 8_00_000 : 6_65_000,
          title: 'Riya & Arjun’s wedding',
          city: 'Pune',
        }),
        ageGroups: ['kids', 'adults', 'seniors'],
        diets: ['veg', 'jain'],
        protectedCategories: ['catering'],
        culture: 'Marathi Hindu',
        mustHaves: ['Pure-veg menu with Jain options', 'Live dhol for the baraat'],
      };
      return {
        ...createPlanState(profile, base),
        progress: {
          'fix-date': { done: true, delayDays: 0 },
          'guest-draft': { done: true, delayDays: 0 },
        },
        quotes: demoQuotes,
      };
    }
    case 'kids-birthday': {
      const profile: EventProfile = {
        ...createProfile({
          eventType: 'birthday',
          eventDate: addDays(today, 30),
          guests: 30,
          budget: 60_000,
          title: 'Aarav turns 6',
          city: 'Bengaluru',
        }),
        ageGroups: ['kids', 'adults'],
        diets: ['veg'],
        mustHaves: ['Nut-free cake'],
      };
      return createPlanState(profile, base);
    }
    case 'society-mela': {
      const profile: EventProfile = {
        ...createProfile({
          eventType: 'community',
          eventDate: addDays(today, 60),
          guests: 300,
          budget: 2_10_000,
          title: 'Green Meadows Diwali Mela',
          city: 'Hyderabad',
        }),
        ageGroups: ['kids', 'teens', 'adults', 'seniors'],
        diets: ['veg'],
        accessNeeds: ['wheelchair'],
        mustHaves: ['Eco-friendly, no firecrackers', 'Rangoli competition'],
      };
      return createPlanState(profile, base);
    }
  }
}

/** A sample change that moves guests, budget and date at once. */
export const CHANGE_TEST_TEXT =
  'We now have 50 more guests, our budget is down by 10%, and the event is happening 2 weeks earlier.';
