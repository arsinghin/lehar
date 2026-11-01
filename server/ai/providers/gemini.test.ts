import type { GenerateContentParameters } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';

import { createGeminiProvider } from './gemini';

describe('createGeminiProvider', () => {
  it('Gemini sends JSON-schema output config with LOW thinking and returns text', async () => {
    const generateContent = vi.fn((_params: GenerateContentParameters) =>
      Promise.resolve({ text: ' {"a":1} ' }),
    );
    const provider = createGeminiProvider({
      apiKey: 'k',
      model: 'gemini-3.8-flash',
      client: { models: { generateContent } },
    });
    const signal = new AbortController().signal;
    const text = await provider.generate({
      system: 's',
      prompt: 'p',
      jsonSchema: { type: 'object' },
      maxOutputTokens: 10,
      signal,
    });
    expect(text).toBe('{"a":1}');
    expect(provider).toMatchObject({ id: 'gemini:gemini-3.8-flash', source: 'gemini' });
    expect(generateContent.mock.calls[0]?.[0]).toMatchObject({
      model: 'gemini-3.8-flash',
      contents: 'p',
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' },
        thinkingConfig: { thinkingLevel: 'LOW' },
        abortSignal: signal,
      },
    });
  });

  it('Gemini maps empty responses and SDK errors to ProviderError', async () => {
    const empty = createGeminiProvider({
      apiKey: 'k',
      model: 'm',
      client: { models: { generateContent: () => Promise.resolve({}) } },
    });
    const input = {
      system: 's',
      prompt: 'p',
      jsonSchema: {},
      maxOutputTokens: 1,
      signal: new AbortController().signal,
    };
    await expect(empty.generate(input)).rejects.toThrow(/Empty/);
    const quota = createGeminiProvider({
      apiKey: 'k',
      model: 'm',
      client: {
        models: {
          generateContent: () => Promise.reject(Object.assign(new Error('quota'), { status: 429 })),
        },
      },
    });
    await expect(quota.generate(input)).rejects.toMatchObject({ status: 429, isTransient: true });
  });

  it('Gemini builds a real SDK client lazily when none is injected', () => {
    expect(createGeminiProvider({ apiKey: 'k', model: 'gemini-3.8-flash' }).id).toBe(
      'gemini:gemini-3.8-flash',
    );
  });
});
