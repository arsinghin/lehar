import { describe, expect, it } from 'vitest';

import { IdeasOutputSchema } from './contract';
import { generateFallbackIdeas } from './ideas';

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
