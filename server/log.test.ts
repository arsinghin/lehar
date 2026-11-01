import { describe, expect, it } from 'vitest';

import { createLogger } from './log';

describe('createLogger', () => {
  it('writes structured JSON lines', () => {
    const lines: string[] = [];
    const write = (message: string) => lines.push(message);
    const logger = createLogger({ info: write, warn: write, error: write });
    logger.info('a', { requestId: 'r', ms: 5 });
    logger.warn('b');
    logger.error('c', { outcome: 'TypeError' });
    expect(lines.map((line) => JSON.parse(line) as unknown)).toEqual([
      { level: 'info', event: 'a', requestId: 'r', ms: 5 },
      { level: 'warn', event: 'b' },
      { level: 'error', event: 'c', outcome: 'TypeError' },
    ]);
  });
});
