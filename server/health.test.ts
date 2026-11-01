import { describe, expect, it } from 'vitest';

import { loadConfig } from './config';
import { healthBody } from './health';

describe('healthBody', () => {
  it('reports configuration as booleans only', () => {
    const body = healthBody(loadConfig({ GEMINI_API_KEY: 'secret-value' }));
    expect(body.ai).toEqual({ gemini: true, openRouter: false, nvidia: false, fallback: 'rules' });
    expect(healthBody(loadConfig({ NVIDIA_API_KEY: 'n' })).models.nvidia).toEqual([
      'nvidia/nemotron-3.5-lightning-30b-a3b',
    ]);
    expect(JSON.stringify(body)).not.toContain('secret-value');
  });
});
