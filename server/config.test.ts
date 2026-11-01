import { describe, expect, it } from 'vitest';

import {
  isAllowedGeminiModel,
  isAllowedNvidiaModel,
  isFreeOpenRouterModel,
  loadConfig,
} from './config';

describe('config: cost safety', () => {
  it('uses free-tier defaults and no keys when env is empty', () => {
    const config = loadConfig({});
    expect(config.gemini).toEqual({
      apiKey: null,
      models: ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
    });
    expect(config.openRouter).toEqual({
      apiKey: null,
      models: ['nvidia/nemotron-3.5-lightning:free'],
      reasoning: 'off',
    });
    expect(config.nvidia).toEqual({
      apiKey: null,
      models: ['nvidia/nemotron-3.5-lightning-30b-a3b'],
    });
    expect(config.rejectedModels).toEqual([]);
  });

  it('reads the NVIDIA key and models, and the OpenRouter reasoning switch', () => {
    const config = loadConfig({
      NVIDIA_API_KEY: ' nv ',
      NVIDIA_MODELS: 'nvidia/nemotron-3-ultra-550b-a55b, not a model, https://evil.example/x',
      OPENROUTER_REASONING: ' LOW ',
    });
    expect(config.nvidia).toEqual({ apiKey: 'nv', models: ['nvidia/nemotron-3-ultra-550b-a55b'] });
    expect(config.openRouter.reasoning).toBe('low');
    expect(config.rejectedModels).toEqual(['not a model', 'https://evil.example/x']);
    expect(loadConfig({ OPENROUTER_REASONING: 'high' }).openRouter.reasoning).toBe('off');
  });

  it.each([
    ['nvidia/nemotron-3.5-lightning-30b-a3b', true],
    ['openai/gpt-oss-20b', true],
    ['nemotron', false],
    ['a/b/c', false],
  ])('isAllowedNvidiaModel(%s) = %s', (id, allowed) => {
    expect(isAllowedNvidiaModel(id)).toBe(allowed);
  });

  it('drops any model that is not on a free tier', () => {
    const config = loadConfig({
      GEMINI_API_KEY: ' key ',
      GEMINI_MODELS: 'gemini-3.8-flash, gemini-3.1-pro, gemini-4-argon, gemma-4-27b',
      OPENROUTER_MODELS: 'openai/gpt-oss-120b:free,anthropic/claude-x,openrouter/auto',
    });
    expect(config.gemini.apiKey).toBe('key');
    expect(config.gemini.models).toEqual(['gemini-3.8-flash', 'gemma-4-27b']);
    expect(config.openRouter.models).toEqual(['openai/gpt-oss-120b:free']);
    expect(config.rejectedModels).toEqual([
      'gemini-3.1-pro',
      'gemini-4-argon',
      'anthropic/claude-x',
      'openrouter/auto',
    ]);
  });

  it.each([
    ['gemini-3.8-flash', true],
    ['gemini-3.1-flash-lite', true],
    ['gemini-2.5-flash-preview-09', true],
    ['gemini-2.5-pro', false],
    ['gemini-3.8-flash-pro', false],
    ['gpt-6', false],
  ])('isAllowedGeminiModel(%s) = %s', (id, allowed) => {
    expect(isAllowedGeminiModel(id)).toBe(allowed);
  });

  it.each([
    ['openai/gpt-oss-120b:free', true],
    ['openrouter/free', true],
    ['openai/gpt-oss-120b', false],
    ['openrouter/auto', false],
    ['free', false],
  ])('isFreeOpenRouterModel(%s) = %s', (id, allowed) => {
    expect(isFreeOpenRouterModel(id)).toBe(allowed);
  });

  it('accepts only well-formed allowed origins', () => {
    expect(
      loadConfig({ ALLOWED_ORIGINS: 'https://a.example, not a url, https://b.example/path' })
        .allowedOrigins,
    ).toEqual(['https://a.example']);
  });
});
