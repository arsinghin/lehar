/** The /api/health body: whether each provider is configured, and its model ids. Never key values. */
import type { ServerConfig } from './config.js';

export interface HealthBody {
  ok: true;
  ai: { gemini: boolean; openRouter: boolean; nvidia: boolean; fallback: 'rules' };
  models: { gemini: string[]; openRouter: string[]; nvidia: string[] };
}

const isConfigured = (provider: { apiKey: string | null; models: readonly string[] }) =>
  provider.apiKey !== null && provider.models.length > 0;

/** The /api/health body for a configuration. */
export function healthBody(config: ServerConfig): HealthBody {
  return {
    ok: true,
    ai: {
      gemini: isConfigured(config.gemini),
      openRouter: isConfigured(config.openRouter),
      nvidia: isConfigured(config.nvidia),
      fallback: 'rules',
    },
    models: {
      gemini: config.gemini.models,
      openRouter: config.openRouter.models,
      nvidia: config.nvidia.models,
    },
  };
}
