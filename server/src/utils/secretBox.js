import crypto from 'node:crypto';

import { env } from '../config/env.js';
import logger from '../config/logger.js';

/**
 * Authenticated symmetric encryption for secrets we must be able to read back
 * (tenant-supplied AI provider keys). AES-256-GCM: the auth tag means a tampered
 * ciphertext fails to decrypt rather than yielding garbage.
 *
 * Passwords are hashed, never encrypted — this is only for values the server has
 * to replay to a third party.
 */
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit nonce, the GCM standard.

let cachedKey = null;

/**
 * 32-byte key from ENCRYPTION_KEY when set. Otherwise derived from the refresh
 * secret so the feature works on existing deploys without a new env var — at the
 * cost that rotating JWT_REFRESH_SECRET makes stored keys unreadable (tenants
 * just re-paste theirs). Set ENCRYPTION_KEY in production to decouple them.
 */
function encryptionKey() {
  if (cachedKey) return cachedKey;

  if (env.ENCRYPTION_KEY) {
    const raw = Buffer.from(env.ENCRYPTION_KEY, 'base64');
    // Accept any sufficiently long secret: hash it down to exactly 32 bytes.
    cachedKey = raw.length === 32 ? raw : crypto.createHash('sha256').update(env.ENCRYPTION_KEY).digest();
  } else {
    logger.warn(
      'ENCRYPTION_KEY is not set — deriving the secret-box key from JWT_REFRESH_SECRET. ' +
        'Set ENCRYPTION_KEY so rotating the JWT secret does not invalidate stored provider keys.',
    );
    cachedKey = crypto.scryptSync(env.JWT_REFRESH_SECRET, 'localschema.secretbox.v1', 32);
  }

  return cachedKey;
}

/** Encrypts a UTF-8 string into base64 parts safe to persist. */
export function sealSecret(plaintext) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

/** Reverses sealSecret. Throws if the payload was tampered with or the key changed. */
export function openSecret({ ciphertext, iv, tag }) {
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

export default { sealSecret, openSecret };
