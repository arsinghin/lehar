/** GET /api/health: which providers are configured (booleans only, never key values). */
import { loadConfig } from '../server/config.js';
import { healthBody } from '../server/health.js';
import { jsonResponse } from '../server/http.js';

export default {
  fetch(request: Request): Response {
    if (request.method !== 'GET') return jsonResponse(405, { ok: false }, { Allow: 'GET' });
    return jsonResponse(200, healthBody(loadConfig()));
  },
};
