import { describe, expect, it } from 'vitest';

import { profile, TODAY } from '../../tests/fixtures';
import { applyProfilePatch, createProfile, displayTitle, relevantCategories } from './profile';

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
