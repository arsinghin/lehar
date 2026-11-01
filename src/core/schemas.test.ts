import { describe, expect, it } from 'vitest';

import { TODAY } from '../../tests/fixtures';
import { createDemoPlan } from './demo';
import { PersistedStoreSchema } from './schemas';

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
