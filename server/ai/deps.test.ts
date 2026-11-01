import { describe, expect, it } from 'vitest';

import { loadConfig } from '../config';
import { buildProviders, getDefaultDeps } from './deps';

describe('wiring', () => {
  it('builds providers only for configured keys, in priority order', () => {
    expect(buildProviders(loadConfig({}))).toEqual([]);
    const providers = buildProviders(
      loadConfig({ GEMINI_API_KEY: 'g', OPENROUTER_API_KEY: 'o', NVIDIA_API_KEY: 'n' }),
    );
    expect(providers.map((p) => p.id)).toEqual([
      'gemini:gemini-3.8-flash',
      'gemini:gemini-3.1-flash-lite',
      'openrouter:nvidia/nemotron-3.5-lightning:free',
      'nvidia:nvidia/nemotron-3.5-lightning-30b-a3b',
    ]);
    // Free endpoints get the longer timeout; two of them still fit inside the overall deadline.
    expect(providers.map((p) => p.timeoutMs)).toEqual([undefined, undefined, 22_000, 22_000]);
    const config = loadConfig({});
    expect(2 * config.timeouts.freeEndpointMs).toBeLessThan(config.timeouts.totalMs);
    expect(config.timeouts.totalMs).toBeLessThan(60_000);
  });

  it('works with only an NVIDIA key', () => {
    expect(buildProviders(loadConfig({ NVIDIA_API_KEY: 'n' })).map((p) => p.source)).toEqual([
      'nvidia',
    ]);
  });

  it('memoises default deps across invocations', () => {
    expect(getDefaultDeps()).toBe(getDefaultDeps());
  });
});
