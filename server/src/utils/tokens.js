import crypto from 'node:crypto';

/** Opaque, URL-safe random token handed to the user (email verify, reset). */
export function generateRawToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Only the digest is persisted, so a database leak does not yield usable
 * verification or password-reset tokens. SHA-256 (not bcrypt) is appropriate
 * here: these tokens are already high-entropy, so there is nothing to brute
 * force, and lookups must stay indexable.
 */
export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/** Length-safe comparison for any secret compared in application code. */
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function addDuration(date, ms) {
  return new Date(date.getTime() + ms);
}

export const DURATIONS = Object.freeze({
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
});

/** Parses "15m" / "7d" / "900" into milliseconds. */
export function parseDuration(value) {
  if (typeof value === 'number') return value * 1000;

  const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(String(value).trim());
  if (!match) throw new Error(`Cannot parse duration: ${value}`);

  const amount = Number(match[1]);
  switch (match[2]) {
    case 'ms':
      return amount;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    case 's':
    default:
      return amount * 1000;
  }
}
