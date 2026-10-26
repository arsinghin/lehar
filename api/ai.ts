/** POST /api/ai: the only endpoint that talks to a model. See server/ai/handler.ts. */
import { getDefaultDeps } from '../server/ai/deps.js';
import { handleAiRequest } from '../server/ai/handler.js';

export default {
  fetch(request: Request): Promise<Response> {
    return handleAiRequest(request, getDefaultDeps());
  },
};
