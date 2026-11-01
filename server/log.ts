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

export type LogLevel = 'info' | 'warn' | 'error';

export type Logger = Record<LogLevel, (event: string, fields?: LogFields) => void>;

type Sink = Record<LogLevel, (message: string) => void>;

/** One JSON line per event, at the matching console level. */
export function createLogger(sink: Sink = console): Logger {
  const at =
    (level: LogLevel) =>
    (event: string, fields: LogFields = {}) => {
      sink[level](JSON.stringify({ level, event, ...fields }));
    };
  return { info: at('info'), warn: at('warn'), error: at('error') };
}

const ignore = () => undefined;
export const silentLogger: Logger = { info: ignore, warn: ignore, error: ignore };
