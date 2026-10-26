import { describe, expect, it } from 'vitest';

import { profile, TODAY } from '../../tests/fixtures';
import {
  toIdeaContext,
  toParseChangeRequest,
  toVendorQuestionsRequest,
  topPriorities,
} from './aiContext';
import {
  buildIcs,
  escapeIcsText,
  foldIcsLine,
  googleCalendarUrl,
  googleMapsSearchUrl,
  icsStamp,
} from './calendar';
import {
  AiRequestSchema,
  budgetBand,
  IdeasOutputSchema,
  ParseChangeOutputSchema,
} from './contract';
import { generateFallbackIdeas } from './ideas';
import {
  createDemoPlan,
  createPlanState,
  DEMO_SCENARIOS,
  derivePlan,
  withProfilePatch,
} from './plan';
import { applyProfilePatch, createProfile, displayTitle, relevantCategories } from './profile';
import { PersistedStoreSchema, PlanStateSchema } from './schemas';

describe('plan lifecycle', () => {
  it.each(DEMO_SCENARIOS.map((scenario) => scenario.id))(
    'demo "%s" is a valid, explorable plan',
    (id) => {
      const demo = createDemoPlan(id, { id: 'd', now: 'now', today: TODAY });
      expect(PlanStateSchema.safeParse(demo).success).toBe(true);
      const derived = derivePlan(demo, TODAY);
      expect(derived.budget.lines.length).toBeGreaterThan(4);
      expect(derived.schedule.tasks.length).toBeGreaterThan(8);
      expect(derived.vendorBriefs.length).toBeGreaterThan(3);
    },
  );

  it('the over-budget demo is about 20% over and offers trade-offs', () => {
    const demo = createDemoPlan('over-budget', { id: 'd', now: 'now', today: TODAY });
    const derived = derivePlan(demo, TODAY);
    expect(derived.budget.gapRatio).toBeGreaterThan(0.18);
    expect(derived.budget.gapRatio).toBeLessThan(0.22);
    expect(derived.tradeoffs.levers.length).toBeGreaterThan(0);
  });

  it('creates and patches plans immutably', () => {
    const state = createPlanState(profile(), { id: 'p', now: 'now', today: TODAY });
    expect(state).toMatchObject({ schemaVersion: 1, startDate: TODAY, isDemo: false, quotes: [] });
    const patched = withProfilePatch(state, { guests: 10, categoryTiers: { decor: 'simple' } });
    expect(patched.profile.guests).toBe(10);
    expect(state.profile.guests).toBe(200);
  });
});

describe('profile helpers', () => {
  it('merges map fields and replaces arrays', () => {
    const base = { ...profile(), categoryTiers: { venue: 'premium' as const } };
    const next = applyProfilePatch(base, {
      categoryTiers: { decor: 'simple' },
      excludedCategories: ['gifts'],
    });
    expect(next.categoryTiers).toEqual({ venue: 'premium', decor: 'simple' });
    expect(next.excludedCategories).toEqual(['gifts']);
  });

  it('knows relevant categories and display titles', () => {
    expect(relevantCategories('birthday')).not.toContain('attire');
    expect(displayTitle(profile())).toBe('Your wedding');
    expect(displayTitle(profile({ title: '  Asha’s 50th ' }))).toBe('Asha’s 50th');
    expect(
      displayTitle(
        createProfile({ eventType: 'community', eventDate: TODAY, guests: 1, budget: 1000 }),
      ),
    ).toBe('Your community event');
  });
});

describe('AI context is minimal and valid', () => {
  it('never includes title, notes or the exact budget for ideas', () => {
    const p = profile({ title: 'Secret family name', notes: 'phone 98765 43210' });
    const context = toIdeaContext(p);
    expect(JSON.stringify(context)).not.toMatch(/Secret|98765|800000/);
    expect(context.budgetBand).toBe('moderate');
    expect(AiRequestSchema.safeParse({ task: 'ideas', context }).success).toBe(true);
  });

  it('builds valid parse-change and vendor-question requests', () => {
    expect(
      AiRequestSchema.safeParse(toParseChangeRequest(profile(), 'something changed', TODAY))
        .success,
    ).toBe(true);
    const vendor = toVendorQuestionsRequest(
      profile({ categoryTiers: { photo: 'premium' } }),
      'photo',
    );
    expect(vendor.context.tier).toBe('premium');
    expect(AiRequestSchema.safeParse(vendor).success).toBe(true);
  });

  it('ranks top priorities, skipping excluded categories', () => {
    expect(topPriorities(profile({ excludedCategories: ['catering'] }))).toEqual([
      'venue',
      'photo',
      'decor',
    ]);
  });

  it.each([
    [100_000, 200, 'tight'],
    [800_000, 200, 'moderate'],
    [2_000_000, 200, 'comfortable'],
  ] as const)('budget band for ₹%i / %i guests is %s', (budget, guests, band) => {
    expect(budgetBand(budget, guests, 'wedding')).toBe(band);
  });

  it('rejects unknown fields and oversized text', () => {
    const context = toIdeaContext(profile());
    expect(AiRequestSchema.safeParse({ task: 'ideas', context, extra: 1 }).success).toBe(false);
    expect(
      AiRequestSchema.safeParse({
        task: 'ideas',
        context: { ...context, culture: 'x'.repeat(500) },
      }).success,
    ).toBe(false);
    expect(AiRequestSchema.safeParse({ task: 'nope' }).success).toBe(false);
    expect(ParseChangeOutputSchema.safeParse({ guestsSet: 99_999 }).success).toBe(false);
  });
});

describe('fallback ideas', () => {
  const kids = {
    eventType: 'birthday' as const,
    guests: 30,
    tier: 'standard' as const,
    ageGroups: ['kids' as const],
    diets: ['veg' as const],
    culture: '',
    mustHaves: ['Nut-free cake'],
  };

  it('returns three schema-valid ideas fitted to the guests', () => {
    const ideas = generateFallbackIdeas(kids);
    expect(ideas).toHaveLength(3);
    expect(IdeasOutputSchema.safeParse({ ideas }).success).toBe(true);
    expect(ideas[0]?.whyItFits).toMatch(/keeps children busy/);
    expect(ideas[0]?.food).toMatch(/Vegetarian.*kids/);
    expect(ideas[0]?.whyItFits).toMatch(/Nut-free cake/);
  });

  it('responds to refinements such as "cheaper" and "elder-friendly"', () => {
    const cheaper = generateFallbackIdeas(kids, 'make it cheaper');
    expect(cheaper.every((idea) => idea.costLevel === 'lower')).toBe(true);
    const elders = generateFallbackIdeas(
      { ...kids, ageGroups: ['seniors'], eventType: 'birthday' },
      'better for elders',
    );
    expect(elders[0]?.whyItFits).toMatch(/comfortable for elders/);
  });

  it('is deterministic, and grand for premium community events', () => {
    const premium = {
      ...kids,
      eventType: 'community' as const,
      tier: 'premium' as const,
      ageGroups: [],
      diets: [],
      guests: 300,
      mustHaves: [],
    };
    expect(generateFallbackIdeas(premium)).toEqual(generateFallbackIdeas(premium));
    expect(generateFallbackIdeas(premium)[0]?.costLevel).toBe('higher');
    expect(
      generateFallbackIdeas({
        ...premium,
        eventType: 'wedding',
        tier: 'simple',
        culture: 'Tamil',
      })[0]?.food,
    ).toMatch(/simple shared/);
  });
});

describe('calendar exports', () => {
  it('builds a valid all-day ICS with escaped, folded text', () => {
    const ics = buildIcs(
      [
        {
          uid: 'book-venue',
          title: 'Book venue; confirm, today',
          date: '2026-11-15',
          description: 'Line 1\nLine 2 ' + 'x'.repeat(100),
        },
      ],
      '20261026T100000Z',
    );
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261115');
    expect(ics).toContain('DTEND;VALUE=DATE:20261116');
    expect(ics).toContain('SUMMARY:Book venue\\; confirm\\, today');
    for (const line of ics.split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('escapes and folds per RFC 5545', () => {
    expect(escapeIcsText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
    expect(foldIcsLine('short')).toBe('short');
    expect(foldIcsLine('é'.repeat(60)).split('\r\n ').length).toBe(2);
    expect(icsStamp(new Date('2026-10-26T10:00:00.123Z'))).toBe('20261026T100000Z');
  });

  it('builds keyless Google Calendar and Maps links', () => {
    const url = new URL(
      googleCalendarUrl({ title: 'Book venue', date: '2026-11-15', description: 'From Lehar' }),
    );
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('dates')).toBe('20261115/20261116');
    const maps = new URL(googleMapsSearchUrl('caterers', ' Pune '));
    expect(maps.searchParams.get('query')).toBe('caterers near Pune');
    expect(new URL(googleMapsSearchUrl('caterers', '')).searchParams.get('query')).toBe('caterers');
  });
});

describe('persisted store schema', () => {
  it('accepts a store with history and rejects tampered data', () => {
    const planState = createDemoPlan('wedding', { id: 'd', now: 'now', today: TODAY });
    const store = {
      storeVersion: 1,
      plan: planState,
      past: [{ at: 'now', reason: 'Created', plan: planState }],
    };
    expect(PersistedStoreSchema.safeParse(store).success).toBe(true);
    const tampered = {
      ...store,
      plan: { ...planState, profile: { ...planState.profile, guests: -5 } },
    };
    expect(PersistedStoreSchema.safeParse(tampered).success).toBe(false);
    expect(
      PersistedStoreSchema.safeParse({ ...store, plan: { ...planState, injected: '<script>' } })
        .success,
    ).toBe(false);
  });
});
