import { describe, expect, it } from 'vitest';

import { profile, quote } from '../../tests/fixtures';
import { estimateBudget } from './budget';
import { compareQuotes, vendorBrief, vendorCategories, vendorProfileFor } from './vendors';

const line = (category: string, p = profile()) => {
  const found = estimateBudget(p).lines.find((l) => l.category === category);
  if (!found) throw new Error(`no ${category} line`);
  return found;
};

describe('vendorBrief', () => {
  it('builds a catering brief from the host profile with a plate buffer and diets', () => {
    const p = profile({ diets: ['veg', 'jain'], ageGroups: ['kids', 'adults'], city: 'Pune' });
    const brief = vendorBrief(p, line('catering', p));
    expect(brief?.requirements).toEqual(
      expect.arrayContaining([
        'About 210 plates (200 guests + 5% buffer)',
        'Menus needed: Vegetarian, Jain',
        'A mild kids’ menu',
        'Style: standard package',
      ]),
    );
    expect(brief?.requirements[0]).toMatch(/in Pune/);
    expect(brief?.target).toBe(220_000);
    expect(brief?.questions.length).toBeGreaterThan(3);
  });

  it('adds accessibility and elder requirements for venues', () => {
    const p = profile({ accessNeeds: ['wheelchair'], ageGroups: ['seniors'] });
    const brief = vendorBrief(p, line('venue', p));
    expect(brief?.requirements).toEqual(
      expect.arrayContaining([
        'Wheelchair access must be available',
        'Comfortable seating and a short walk for elders',
      ]),
    );
  });

  it('covers photo requirements and has no vendor brief for attire', () => {
    expect(vendorBrief(profile(), line('photo'))?.requirements).toContain(
      'Coverage for 200 guests',
    );
    expect(vendorBrief(profile(), line('attire'))).toBeNull();
    expect(vendorProfileFor('attire')).toBeUndefined();
  });

  it('lists only categories that need vendors', () => {
    expect(vendorCategories(estimateBudget(profile()).lines)).toEqual([
      'venue',
      'catering',
      'decor',
      'photo',
      'entertainment',
      'logistics',
    ]);
  });
});

describe('compareQuotes', () => {
  const complete = [
    'GST / taxes',
    'Service staff',
    'Crockery & cutlery',
    'Live counters',
    'Tasting session',
    'Transport',
  ];

  it('flags short guest coverage, overruns and missing inclusions', () => {
    const result = compareQuotes(
      'catering',
      [quote({ id: 'a', amount: 250_000, guestsCovered: 180, inclusions: ['Service staff'] })],
      200,
      220_000,
    );
    const row = result.rows[0];
    expect(row?.coversGuests).toBe(false);
    expect(row?.vsTarget).toBe(30_000);
    expect(row?.perGuest).toBe(1250);
    expect(row?.flags).toEqual(
      expect.arrayContaining([
        'Covers 180 of 200 guests',
        '₹30,000 above your estimate',
        'Clarify: GST / taxes',
      ]),
    );
    expect(result.lowestCompleteId).toBeNull();
  });

  it('picks the lowest complete quote without ranking quality', () => {
    const result = compareQuotes(
      'catering',
      [
        quote({ id: 'a', amount: 240_000, inclusions: complete }),
        quote({ id: 'b', amount: 210_000, inclusions: complete }),
        quote({ id: 'c', amount: 150_000, inclusions: [] }),
        quote({ id: 'd', category: 'venue', amount: 1 }),
      ],
      200,
      220_000,
    );
    expect(result.rows).toHaveLength(3);
    expect(result.lowestCompleteId).toBe('b');
  });

  it('asks how many guests a quote covers when unknown, and handles a missing target', () => {
    const row = compareQuotes('catering', [quote({ guestsCovered: null })], 200, null).rows[0];
    expect(row?.coversGuests).toBeNull();
    expect(row?.vsTarget).toBeNull();
    expect(row?.flags).toContain('Ask how many guests this covers');
  });

  it('handles categories without a checklist', () => {
    const result = compareQuotes('attire', [quote({ category: 'attire' })], 0, 100);
    expect(result.rows[0]?.missingInclusions).toEqual([]);
    expect(result.rows[0]?.perGuest).toBeNull();
  });
});
