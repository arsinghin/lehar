/** Shared inputs and fake fetch responses for the provider tests. */
import { vi } from 'vitest';

import type { GenerateInput } from '../../server/ai/providers/types';

/** A minimal generate() input; override any field. */
export const providerInput = (overrides: Partial<GenerateInput> = {}): GenerateInput => ({
  system: 's',
  prompt: 'p',
  jsonSchema: { type: 'object' },
  maxOutputTokens: 50,
  signal: new AbortController().signal,
  ...overrides,
});

/** A fetch that answers every call with one chat completion containing `content`. */
export const okFetch = (content: unknown = '{"ok":true}') =>
  vi.fn((_url: string | URL | Request, _init?: RequestInit) =>
    Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content } }] }))),
  );

/** The JSON body of the first request made through `fetchImpl`. */
export const sentBody = (fetchImpl: ReturnType<typeof okFetch>) =>
  JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string) as Record<string, unknown> & {
    messages: { role: string; content: string }[];
  };
