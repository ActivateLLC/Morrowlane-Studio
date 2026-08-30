export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

function emit(minLevel: LogLevel, base: Record<string, unknown>, level: LogLevel, message: string, fields?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, message, ...base, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function createLogger(scope: string, options: { level?: LogLevel; fields?: Record<string, unknown> } = {}): Logger {
  const level = options.level ?? ((process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info');
  const base = { scope, ...(options.fields ?? {}) };
  return {
    debug: (m, f) => emit(level, base, 'debug', m, f),
    info: (m, f) => emit(level, base, 'info', m, f),
    warn: (m, f) => emit(level, base, 'warn', m, f),
    error: (m, f) => emit(level, base, 'error', m, f),
    child: (fields) => createLogger(scope, { level, fields: { ...options.fields, ...fields } }),
  };
}
