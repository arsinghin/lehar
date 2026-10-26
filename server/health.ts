import type { ServerConfig } from './config.js';

export interface HealthBody {
  ok: true;
  ai: { gemini: boolean; openRouter: boolean; nvidia: boolean; fallback: 'rules' };
  models: { gemini: string[]; openRouter: string[]; nvidia: string[] };
}

export function healthBody(config: ServerConfig): HealthBody {
  return {
    ok: true,
    ai: {
      gemini: config.gemini.apiKey !== null && config.gemini.models.length > 0,
      openRouter: config.openRouter.apiKey !== null && config.openRouter.models.length > 0,
      nvidia: config.nvidia.apiKey !== null && config.nvidia.models.length > 0,
      fallback: 'rules',
    },
    models: {
      gemini: config.gemini.models,
      openRouter: config.openRouter.models,
      nvidia: config.nvidia.models,
    },
  };
}
