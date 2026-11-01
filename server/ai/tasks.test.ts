import { describe, expect, it } from 'vitest';

import { TASKS } from './tasks';

describe('task specs', () => {
  it('parseChange post-processing keeps understood output and rejects empty output', () => {
    expect(TASKS.parseChange.postProcess({ guestsDelta: 5, clarification: '' })).toEqual({
      guestsDelta: 5,
    });
    expect(TASKS.parseChange.postProcess({ clarification: 'How many?' })).toEqual({
      clarification: 'How many?',
    });
    expect(TASKS.parseChange.postProcess({})).toBeNull();
  });

  it('vendor-question post-processing de-duplicates and sanitizes', () => {
    const output = TASKS.vendorQuestions.postProcess({
      questions: [
        'Is GST included in the quote?',
        'is gst included in the quote?',
        'Call 98765 43210',
        'short',
      ],
    });
    expect(output).toEqual({ questions: ['Is GST included in the quote?'] });
    expect(TASKS.vendorQuestions.postProcess({ questions: ['tiny'] })).toBeNull();
  });

  it('falls back to the generic vendor questions for categories without a checklist', () => {
    const fallback = TASKS.vendorQuestions.fallback({
      task: 'vendorQuestions',
      category: 'attire',
      context: {
        eventType: 'wedding',
        guests: 10,
        tier: 'simple',
        ageGroups: [],
        diets: [],
        accessNeeds: [],
      },
    });
    expect(fallback.questions.length).toBe(3);
  });
});
