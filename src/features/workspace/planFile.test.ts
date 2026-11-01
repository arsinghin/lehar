import { describe, expect, it } from 'vitest';

import { plan } from '../../../tests/fixtures';
import { loadPlanFile } from './planFile';

const fileOf = (text: string, name = 'plan.lehar.json') => new File([text], name);

describe('loadPlanFile', () => {
  it('loads a valid plan and names the file in the history reason', async () => {
    const loaded = await loadPlanFile(fileOf(JSON.stringify(plan()), 'x'.repeat(80) + '.json'));
    expect(loaded).toMatchObject({ ok: true, plan: { id: 'plan-1' } });
    if (loaded.ok) expect(loaded.reason).toBe(`Loaded plan from ${'x'.repeat(60)}`);
  });

  it('turns invalid content and unreadable files into messages', async () => {
    expect(await loadPlanFile(fileOf('{"not":"a plan"}'))).toMatchObject({
      ok: false,
      message: expect.stringMatching(/not a valid Lehar plan/) as string,
    });
    const unreadable = { name: 'x.json', text: () => Promise.reject(new Error('io')) } as File;
    expect(await loadPlanFile(unreadable)).toEqual({
      ok: false,
      message: 'That file could not be read. Please try again.',
    });
  });
});
