/**
 * Production wiring. Module-level singletons persist across warm invocations on Vercel Fluid compute,
 * so the cache, rate limiter and circuit breaker are shared between requests on an instance.
 */
import { randomUUID } from 'node:crypto';

import type { AiSuccessBody, AiTask } from '../../src/core/contract.js';
import { TtlCache } from '../cache.js';
import { loadConfig, type ServerConfig } from '../config.js';
import { createLogger } from '../log.js';
import { RateLimiter } from '../security/rateLimit.js';
import { CircuitBreaker } from './breaker.js';
import type { HandlerDeps } from './handler.js';
import { createGeminiProvider } from './providers/gemini.js';
import { createNvidiaProvider } from './providers/nvidia.js';
import { createOpenRouterProvider } from './providers/openrouter.js';
import type { AiProvider } from './providers/types.js';

/** Every configured provider, in fallback order: Gemini, then OpenRouter, then NVIDIA NIM. */
export function buildProviders(
  config: ServerConfig,
  fetchImpl: typeof fetch = fetch,
): AiProvider[] {
  const { gemini, openRouter, nvidia, timeouts } = config;
  const timeoutMs = timeouts.freeEndpointMs;
  const withKey = <T>(
    apiKey: string | null,
    models: readonly string[],
    make: (key: string, model: string) => T,
  ) => (apiKey ? models.map((model) => make(apiKey, model)) : []);
  return [
    ...withKey(gemini.apiKey, gemini.models, (apiKey, model) =>
      createGeminiProvider({ apiKey, model }),
    ),
    ...withKey(openRouter.apiKey, openRouter.models, (apiKey, model) =>
      createOpenRouterProvider({
        apiKey,
        model,
        reasoning: openRouter.reasoning,
        timeoutMs,
        fetchImpl,
      }),
    ),
    ...withKey(nvidia.apiKey, nvidia.models, (apiKey, model) =>
      createNvidiaProvider({ apiKey, model, timeoutMs, fetchImpl }),
    ),
  ];
}

let deps: HandlerDeps | undefined;

/** The production dependencies, created once per instance and reused by warm invocations. */
export function getDefaultDeps(): HandlerDeps {
  if (deps) return deps;
  const config = loadConfig();
  const logger = createLogger();
  if (config.rejectedModels.length > 0)
    logger.warn('models_rejected', {
      count: config.rejectedModels.length,
      outcome: 'not_free_tier',
    });
  deps = {
    config,
    providers: buildProviders(config),
    cache: new TtlCache<AiSuccessBody<AiTask>>(config.cache.maxEntries, config.cache.ttlMs),
    limiter: new RateLimiter(config.rateLimit),
    breaker: new CircuitBreaker(),
    logger,
    randomId: randomUUID,
  };
  return deps;
}
