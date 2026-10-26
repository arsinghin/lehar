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
import { CircuitBreaker } from './chain.js';
import type { HandlerDeps } from './handler.js';
import { createGeminiProvider } from './providers/gemini.js';
import { createOpenRouterProvider } from './providers/openrouter.js';
import type { AiProvider } from './providers/types.js';

export function buildProviders(
  config: ServerConfig,
  fetchImpl: typeof fetch = fetch,
): AiProvider[] {
  const providers: AiProvider[] = [];
  const geminiKey = config.gemini.apiKey;
  if (geminiKey)
    for (const model of config.gemini.models)
      providers.push(createGeminiProvider({ apiKey: geminiKey, model }));
  const openRouterKey = config.openRouter.apiKey;
  if (openRouterKey) {
    for (const model of config.openRouter.models)
      providers.push(
        createOpenRouterProvider({
          apiKey: openRouterKey,
          model,
          timeoutMs: config.timeouts.openRouterMs,
          fetchImpl,
        }),
      );
  }
  return providers;
}

let deps: HandlerDeps | undefined;

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
    cache: new TtlCache<AiSuccessBody<AiTask>>(200, 60 * 60 * 1000),
    limiter: new RateLimiter(config.rateLimit),
    breaker: new CircuitBreaker(),
    logger,
    randomId: randomUUID,
  };
  return deps;
}
