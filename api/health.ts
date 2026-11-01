/** GET /api/health: which providers are configured and with which models. Never key values. */
import { randomUUID } from 'node:crypto';

import { loadConfig } from '../server/config.js';
import { healthBody } from '../server/health.js';
import { errorResponse, jsonResponse } from '../server/http.js';

export default {
  fetch(request: Request): Response {
    if (request.method !== 'GET') {
      return errorResponse(405, 'method_not_allowed', 'Use GET.', {
        requestId: randomUUID(),
        headers: { Allow: 'GET' },
      });
    }
    return jsonResponse(200, healthBody(loadConfig()));
  },
};
