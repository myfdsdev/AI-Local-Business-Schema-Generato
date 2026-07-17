import { env, isTest } from './env.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const activeLevel = isTest ? LEVELS.error : env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug;

function emit(level, message, meta) {
  if (LEVELS[level] > activeLevel) return;

  const entry = { level, time: new Date().toISOString(), message };
  if (meta && Object.keys(meta).length > 0) entry.meta = meta;

  const line = env.NODE_ENV === 'production' ? JSON.stringify(entry) : formatPretty(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function formatPretty({ level, time, message, meta }) {
  const stamp = time.slice(11, 19);
  const tag = level.toUpperCase().padEnd(5);
  const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
  return `${stamp} ${tag} ${message}${suffix}`;
}

export const logger = {
  error: (message, meta) => emit('error', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  info: (message, meta) => emit('info', message, meta),
  debug: (message, meta) => emit('debug', message, meta),
};

export default logger;
