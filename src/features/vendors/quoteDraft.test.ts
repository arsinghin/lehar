import { describe, expect, it } from 'vitest';

import { EMPTY_QUOTE_DRAFT, quoteFromDraft } from './quoteDraft';

describe('quoteFromDraft', () => {
  it('builds a received quote, trimming text and reading Indian amounts', () => {
    const result = quoteFromDraft(
      {
        ...EMPTY_QUOTE_DRAFT,
        vendorLabel: '  Annapurna  ',
        amount: '2.4 lakh',
        guestsCovered: '220',
        notes: ' Includes tasting ',
      },
      'catering',
      'q1',
    );
    expect(result).toEqual({
      ok: true,
      quote: {
        id: 'q1',
        category: 'catering',
        vendorLabel: 'Annapurna',
        amount: 240_000,
        guestsCovered: 220,
        inclusions: [],
        notes: 'Includes tasting',
        status: 'received',
      },
    });
  });

  it('reports every field that needs fixing', () => {
    expect(
      quoteFromDraft({ ...EMPTY_QUOTE_DRAFT, guestsCovered: 'lots' }, 'catering', 'q'),
    ).toEqual({
      ok: false,
      errors: {
        vendorLabel: 'Give the vendor a name or label.',
        amount: 'Enter the quoted total, for example “2.3 lakh”.',
        guestsCovered: 'Enter a whole number of guests.',
      },
    });
  });

  it('treats an empty guest count as not stated', () => {
    const result = quoteFromDraft(
      { ...EMPTY_QUOTE_DRAFT, vendorLabel: 'A', amount: '50000' },
      'decor',
      'q',
    );
    expect(result.ok && result.quote.guestsCovered).toBeNull();
  });
});
