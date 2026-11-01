import { describe, expect, it } from 'vitest';

import { profile, TODAY } from '../../tests/fixtures';
import {
  budgetBand,
  toIdeaContext,
  toParseChangeRequest,
  toVendorQuestionsRequest,
  topPriorities,
} from './aiContext';
import { AiRequestSchema, ParseChangeOutputSchema } from './contract';

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
