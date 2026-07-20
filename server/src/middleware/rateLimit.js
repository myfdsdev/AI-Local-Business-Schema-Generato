import rateLimit from 'express-rate-limit';

import { ERROR_CODES } from '../config/constants.js';
import { isTest } from '../config/env.js';

/**
 * Rate limiters (spec section 23).
 *
 * Counters live in memory, which is per-process. That is fine for the MVP's
 * single instance; running more than one replica needs the Redis store the
 * spec keeps optional.
 */
function build({ windowMs, max, message, keyGenerator }) {
  return rateLimit({
    windowMs,
    max: isTest ? 100_000 : max, // effectively disabled under test
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        message,
        code: ERROR_CODES.RATE_LIMITED,
        errors: [],
      });
    },
  });
}

export const generalLimiter = build({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Too many requests. Please slow down and try again shortly.',
});

/**
 * Login and registration are keyed on IP + email rather than IP alone, so one
 * person on a shared IP cannot lock everyone else out, and an attacker cannot
 * spread a guessing run across many accounts under one IP budget.
 */
export const authLimiter = build({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many attempts. Please wait a few minutes and try again.',
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email ?? '').toLowerCase()}`,
});

export const scanLimiter = build({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many scans started. Please wait a moment before scanning again.',
  keyGenerator: (req) => String(req.user?._id ?? req.ip),
});

export default { generalLimiter, authLimiter, scanLimiter };
