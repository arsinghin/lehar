import { describe, expect, it, vi } from 'vitest';

import { fakeProvider, IDEAS_REQUEST, VALID_IDEAS } from '../../tests/server/aiTesting';
import { silentLogger } from '../log';
import { CircuitBreaker } from './breaker';
import { runProviderChain } from './chain';
import { SYSTEM_PROMPT } from './prompts';
import { ProviderError } from './providers/types';
import { TASKS } from './tasks';

describe('runProviderChain', () => {
  const options = (overrides = {}) => ({
    providerTimeoutMs: 1000,
    totalTimeoutMs: 5000,
    breaker: new CircuitBreaker(),
    logger: silentLogger,
    requestId: 'r',
    ...overrides,
  });

  it('tries providers in order until one returns valid output', async () => {
    const order: string[] = [];
    const providers = [
      fakeProvider('a', () => {
        order.push('a');
        return Promise.reject(new ProviderError('quota', 429));
      }),
      fakeProvider('b', () => {
        order.push('b');
        return Promise.resolve('not json at all');
      }),
      fakeProvider('c', () => {
        order.push('c');
        return Promise.resolve(JSON.stringify({ ideas: [{ title: 'x' }] }));
      }),
      fakeProvider(
        'd',
        () => {
          order.push('d');
          return Promise.resolve('```json\n' + VALID_IDEAS + '\n```');
        },
        'openrouter',
      ),
    ];
    const result = await runProviderChain(providers, TASKS.ideas, IDEAS_REQUEST, options());
    expect(order).toEqual(['a', 'b', 'c', 'd']);
    expect(result?.provider.id).toBe('d');
  });

  it('trips the breaker on transient errors and skips that provider next time', async () => {
    const breaker = new CircuitBreaker(60_000);
    const flaky = fakeProvider('flaky', () => Promise.reject(new ProviderError('busy', 503)));
    await runProviderChain([flaky], TASKS.ideas, IDEAS_REQUEST, options({ breaker }));
    expect(breaker.isOpen('flaky')).toBe(true);
    await runProviderChain([flaky], TASKS.ideas, IDEAS_REQUEST, options({ breaker }));
    expect(flaky.generate).toHaveBeenCalledTimes(1);
  });

  it('does not trip the breaker for bad output', async () => {
    const breaker = new CircuitBreaker();
    const bad = fakeProvider('bad', () => Promise.resolve('{}'));
    expect(
      await runProviderChain([bad], TASKS.ideas, IDEAS_REQUEST, options({ breaker })),
    ).toBeNull();
    expect(breaker.isOpen('bad')).toBe(false);
  });

  it('rejects output that is empty after sanitizing', async () => {
    const onlyUrls = JSON.stringify({
      ideas: [
        {
          ...(JSON.parse(VALID_IDEAS) as { ideas: Record<string, unknown>[] }).ideas[0],
          title: 'https://spam.example',
          summary: 'www.x.com',
        },
      ],
    });
    const provider = fakeProvider('p', () => Promise.resolve(onlyUrls));
    expect(await runProviderChain([provider], TASKS.ideas, IDEAS_REQUEST, options())).toBeNull();
  });

  it('stops when the overall deadline is nearly used up', async () => {
    let clock = 0;
    const slow = fakeProvider('slow', () => {
      clock += 4_000;
      return Promise.reject(new ProviderError('timeout', 408));
    });
    const next = fakeProvider('next', () => Promise.resolve(VALID_IDEAS));
    const result = await runProviderChain(
      [slow, next],
      TASKS.ideas,
      IDEAS_REQUEST,
      options({ now: () => clock }),
    );
    expect(result).toBeNull();
    expect(next.generate).not.toHaveBeenCalled();
  });

  it("uses a provider's own timeout, capped by the time left", async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const slowFree = {
      ...fakeProvider('free', () => Promise.resolve(VALID_IDEAS)),
      timeoutMs: 3000,
    };
    await runProviderChain([slowFree], TASKS.ideas, IDEAS_REQUEST, options());
    await runProviderChain(
      [{ ...slowFree, timeoutMs: 9000 }],
      TASKS.ideas,
      IDEAS_REQUEST,
      options({ now: () => 0 }),
    );
    expect(timeout.mock.calls.map(([ms]) => ms)).toEqual([3000, 5000]);
    timeout.mockRestore();
  });

  it('passes the shared system prompt, the schema and an abort signal to providers', async () => {
    const provider = fakeProvider('p', () => Promise.resolve(VALID_IDEAS));
    await runProviderChain([provider], TASKS.ideas, IDEAS_REQUEST, options());
    const input = vi.mocked(provider.generate).mock.calls[0]?.[0];
    expect(input?.system).toBe(SYSTEM_PROMPT);
    expect(input?.jsonSchema).toHaveProperty('properties.ideas');
    expect(input?.signal).toBeInstanceOf(AbortSignal);
  });
});
