import { describe, expect, it } from 'vitest';

import { okFetch, providerInput, sentBody } from '../../../tests/server/providerTesting';
import { REASONING_HEADROOM_TOKENS } from './openaiCompatible';
import {
  createOpenRouterProvider,
  describeOpenRouterError,
  OPENROUTER_ENDPOINT,
} from './openrouter';

describe('createOpenRouterProvider', () => {
  it('OpenRouter posts an OpenAI-compatible body with reasoning off by default', async () => {
    const fetchImpl = okFetch();
    const provider = createOpenRouterProvider({
      apiKey: 'or-key',
      model: 'nvidia/nemotron-3.5-lightning:free',
      fetchImpl,
    });
    expect(await provider.generate(providerInput())).toBe('{"ok":true}');
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(OPENROUTER_ENDPOINT);
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer or-key');
    const body = sentBody(fetchImpl);
    expect(body).toMatchObject({
      model: 'nvidia/nemotron-3.5-lightning:free',
      max_tokens: 50 + REASONING_HEADROOM_TOKENS,
      response_format: { type: 'json_schema' },
      reasoning: { enabled: false },
    });
    // The schema is repeated in the prompt for models that ignore response_format.
    expect(body.messages[0]?.content).toContain('{"type":"object"}');
  });

  it('OpenRouter sends a low reasoning effort for models that require reasoning', async () => {
    const fetchImpl = okFetch();
    const provider = createOpenRouterProvider({
      apiKey: 'k',
      model: 'openai/gpt-oss-120b:free',
      reasoning: 'low',
      timeoutMs: 22_000,
      fetchImpl,
    });
    await provider.generate(providerInput());
    expect(sentBody(fetchImpl).reasoning).toEqual({ effort: 'low', exclude: true });
    expect(provider.timeoutMs).toBe(22_000);
  });

  it('OpenRouter explains common failures without logging their content', () => {
    expect(describeOpenRouterError(400, { error: { message: 'Reasoning is mandatory' } })).toMatch(
      /OPENROUTER_REASONING=low/,
    );
    expect(describeOpenRouterError(401, null)).toMatch(/OPENROUTER_API_KEY/);
    expect(describeOpenRouterError(402, null)).toMatch(/:free/);
    expect(
      describeOpenRouterError(404, {
        error: { message: 'No endpoints found matching your data policy (Free model publication)' },
      }),
    ).toMatch(/privacy settings/);
    expect(describeOpenRouterError(404, { error: {} })).toMatch(/not found/);
    expect(describeOpenRouterError(429, 'not json')).toMatch(/rate limit/);
    expect(describeOpenRouterError(503, null)).toBe('OpenRouter HTTP 503');
  });
});
