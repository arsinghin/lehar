/**
 * Server configuration, read once per cold start. Keys, models and allowed origins come from
 * environment variables; limits, timeouts and cache sizes are fixed operational defaults below.
 *
 * Cost safety is enforced here, not just in documentation:
 * - Only Gemini Flash / Flash-Lite and Gemma model ids are accepted (free-tier families).
 * - Only OpenRouter ids ending in ":free" (or the "openrouter/free" router) are accepted.
 * - NVIDIA NIM ids must be plain catalog ids ("publisher/model"). NIM is meant to be used with a free
 *   NVIDIA Developer Program key, which has rate limits but no billing; pick "Free Endpoint" models.
 * Anything else is dropped and reported, so a typo can never route traffic to a paid model.
 */

/** "off" disables reasoning (fastest). "low" is for models that require reasoning, such as gpt-oss. */
export type OpenRouterReasoning = 'off' | 'low';

export interface ServerConfig {
  gemini: { apiKey: string | null; models: string[] };
  openRouter: { apiKey: string | null; models: string[]; reasoning: OpenRouterReasoning };
  nvidia: { apiKey: string | null; models: string[] };
  allowedOrigins: string[];
  rateLimit: { perMinute: number; perDay: number };
  cache: { maxEntries: number; ttlMs: number };
  /**
   * providerMs: per Gemini attempt. freeEndpointMs: per OpenRouter or NVIDIA attempt (free endpoints
   * are slower). totalMs: the whole chain, kept under the function's maxDuration of 60 s in vercel.json.
   */
  timeouts: { providerMs: number; freeEndpointMs: number; totalMs: number };
  rejectedModels: string[];
}

/** Per client and instance: enough for real planning, too few to drain the free quota. */
export const RATE_LIMIT = { perMinute: 8, perDay: 80 } as const;
/** Gemini answers quickly; free OpenRouter/NVIDIA endpoints are slower. Total stays under maxDuration. */
export const TIMEOUTS = { providerMs: 12_000, freeEndpointMs: 22_000, totalMs: 50_000 } as const;
/** Identical requests within an hour are answered from memory. */
export const RESPONSE_CACHE = { maxEntries: 200, ttlMs: 60 * 60 * 1000 } as const;

export const DEFAULT_GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
export const DEFAULT_OPENROUTER_MODELS = ['nvidia/nemotron-3.5-lightning:free'];
export const DEFAULT_NVIDIA_MODELS = ['nvidia/nemotron-3.5-lightning-30b-a3b'];

const GEMINI_FREE_FAMILY =
  /^(?:gemini-\d+(?:\.\d+)?-flash(?:-lite)?(?:-[a-z0-9-]+)?|gemma-[a-z0-9.-]+)$/;
const OPENROUTER_FREE = /^[a-z0-9._-]+\/[a-z0-9._-]+:free$/i;
const NVIDIA_CATALOG_ID = /^[a-z0-9._-]+\/[a-z0-9._-]+$/i;

/** True for Gemini Flash, Flash-Lite and Gemma ids, the free-tier families. */
export function isAllowedGeminiModel(id: string): boolean {
  return GEMINI_FREE_FAMILY.test(id) && !/-pro\b/.test(id);
}

/** True for OpenRouter ids that end in ":free", and for the free router itself. */
export function isFreeOpenRouterModel(id: string): boolean {
  return id === 'openrouter/free' || OPENROUTER_FREE.test(id);
}

/** True for plain NVIDIA catalog ids ("publisher/model"). */
export function isAllowedNvidiaModel(id: string): boolean {
  return NVIDIA_CATALOG_ID.test(id);
}

type Env = Readonly<Record<string, string | undefined>>;

function list(value: string | undefined, fallback: readonly string[]): string[] {
  const items = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items.length > 0 ? items : [...fallback];
}

function secret(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function origins(value: string | undefined): string[] {
  return list(value, []).filter((origin) => {
    try {
      return new URL(origin).origin === origin;
    } catch {
      return false;
    }
  });
}

/** Reads and validates the configuration; models outside the free tiers are dropped and listed. */
export function loadConfig(env: Env = process.env): ServerConfig {
  const rejected: string[] = [];
  const keep = (ids: string[], allowed: (id: string) => boolean) =>
    ids.filter((id) => {
      if (allowed(id)) return true;
      rejected.push(id);
      return false;
    });
  return {
    gemini: {
      apiKey: secret(env.GEMINI_API_KEY),
      models: keep(list(env.GEMINI_MODELS, DEFAULT_GEMINI_MODELS), isAllowedGeminiModel),
    },
    openRouter: {
      apiKey: secret(env.OPENROUTER_API_KEY),
      models: keep(list(env.OPENROUTER_MODELS, DEFAULT_OPENROUTER_MODELS), isFreeOpenRouterModel),
      reasoning: env.OPENROUTER_REASONING?.trim().toLowerCase() === 'low' ? 'low' : 'off',
    },
    nvidia: {
      apiKey: secret(env.NVIDIA_API_KEY),
      models: keep(list(env.NVIDIA_MODELS, DEFAULT_NVIDIA_MODELS), isAllowedNvidiaModel),
    },
    allowedOrigins: origins(env.ALLOWED_ORIGINS),
    rateLimit: { ...RATE_LIMIT },
    cache: { ...RESPONSE_CACHE },
    timeouts: { ...TIMEOUTS },
    rejectedModels: rejected,
  };
}
