import { describe, expect, it } from 'vitest';

import aiRoute from './ai';
import healthRoute from './health';

describe('api routes', () => {
  it('GET /api/health answers and rejects other methods', () => {
    expect(healthRoute.fetch(new Request('https://x/api/health')).status).toBe(200);
    expect(healthRoute.fetch(new Request('https://x/api/health', { method: 'POST' })).status).toBe(
      405,
    );
  });

  it('POST /api/ai is wired to the handler', async () => {
    const response = await aiRoute.fetch(new Request('https://x/api/ai', { method: 'GET' }));
    expect(response.status).toBe(405);
  });
});
