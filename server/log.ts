/**
 * Structured, content-free logging. Only operational fields are accepted, never user text or model
 * output, so logs cannot leak what people typed.
 */

export interface LogFields {
  requestId?: string;
  task?: string;
  provider?: string;
  outcome?: string;
  status?: number;
  ms?: number;
  cached?: boolean;
  count?: number;
}

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
}

interface Sink {
  info(message: string): void;
  warn(message: string): void;
}

export function createLogger(sink: Sink = console): Logger {
  const write = (level: 'info' | 'warn', event: string, fields: LogFields = {}) => {
    sink[level](JSON.stringify({ level, event, ...fields }));
  };
  return {
    info: (event, fields) => {
      write('info', event, fields);
    },
    warn: (event, fields) => {
      write('warn', event, fields);
    },
  };
}

export const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
};
