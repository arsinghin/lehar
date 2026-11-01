import { describe, expect, it } from 'vitest';

import { TODAY } from '../../../tests/fixtures';
import { addDays } from '../../core/dates';
import {
  budgetPreview,
  draftToProfile,
  FIELD_IDS,
  initialDraft,
  parseMustHaves,
  validateAll,
  validateStep,
  withEventType,
  type IntakeDraft,
} from './intakeDraft';

const filled = (overrides: Partial<IntakeDraft> = {}): IntakeDraft => ({
  ...initialDraft(TODAY),
  guests: '200',
  budget: '8 lakh',
  ...overrides,
});

describe('intake draft', () => {
  it('defaults the date to a sensible lead time per event type', () => {
    expect(initialDraft(TODAY).eventDate).toBe(addDays(TODAY, 120));
    expect(initialDraft(TODAY, 'birthday').eventDate).toBe(addDays(TODAY, 30));
  });

  it('switching event type resets priorities and drops irrelevant protections', () => {
    const draft = {
      ...initialDraft(TODAY),
      protectedCategories: ['attire' as const, 'catering' as const],
    };
    const birthday = withEventType(draft, 'birthday', TODAY);
    expect(birthday.priorities.entertainment).toBe(4);
    expect(birthday.protectedCategories).toEqual(['catering']);
    expect(withEventType(birthday, 'birthday', TODAY)).toBe(birthday);
  });

  it('validates the date step', () => {
    const ids = (draft: IntakeDraft) => validateStep(0, draft, TODAY).map((error) => error.fieldId);
    expect(ids(filled())).toEqual([]);
    expect(ids(filled({ eventDate: '' }))).toEqual([FIELD_IDS.eventDate]);
    expect(validateStep(0, filled({ eventDate: addDays(TODAY, -1) }), TODAY)[0]?.message).toMatch(
      /past/,
    );
    expect(validateStep(0, filled({ eventDate: addDays(TODAY, 800) }), TODAY)[0]?.message).toMatch(
      /two years/,
    );
    expect(ids(filled({ title: 'x'.repeat(81), city: 'y'.repeat(61) }))).toEqual([
      FIELD_IDS.title,
      FIELD_IDS.city,
    ]);
  });

  it('validates guests and budget in Indian formats', () => {
    const messages = (draft: IntakeDraft) =>
      validateStep(1, draft, TODAY).map((error) => error.message);
    expect(messages(filled({ guests: '1,200', budget: '₹12,00,000' }))).toEqual([]);
    expect(messages(filled({ guests: '', budget: '' }))).toHaveLength(2);
    expect(messages(filled({ guests: '2.5' }))[0]).toMatch(/whole number/);
    expect(messages(filled({ guests: '0' }))[0]).toMatch(/between/);
    expect(messages(filled({ budget: '500' }))[0]).toMatch(/between/);
  });

  it('validates the people step', () => {
    expect(validateStep(3, filled({ mustHaves: 'a\nb\nc\nd\ne\nf' }), TODAY)[0]?.message).toMatch(
      /up to 5/,
    );
    expect(validateStep(3, filled({ mustHaves: 'x'.repeat(61) }), TODAY)[0]?.message).toMatch(
      /under 60/,
    );
    expect(validateStep(3, filled({ culture: 'x'.repeat(81) }), TODAY)[0]?.fieldId).toBe(
      FIELD_IDS.culture,
    );
    expect(validateStep(2, filled(), TODAY)).toEqual([]);
  });

  it('builds a valid profile from a complete draft', () => {
    const profile = draftToProfile(
      filled({
        title: ' Riya ',
        city: ' Pune ',
        mustHaves: 'Live dhol, Pure veg',
        protectedCategories: ['catering'],
      }),
      TODAY,
    );
    expect(profile).toMatchObject({
      guests: 200,
      budget: 800_000,
      title: 'Riya',
      city: 'Pune',
      mustHaves: ['Live dhol', 'Pure veg'],
      protectedCategories: ['catering'],
    });
    expect(draftToProfile(filled({ guests: 'abc' }), TODAY)).toBeNull();
    expect(validateAll(filled({ guests: 'abc' }), TODAY)).toHaveLength(1);
  });

  it('parses helpers', () => {
    expect(parseMustHaves('a; b\n\n c ,')).toEqual(['a', 'b', 'c']);
    expect(budgetPreview('8 lakh')).toBe('= ₹8,00,000');
    expect(budgetPreview('lots')).toBeNull();
  });
});
