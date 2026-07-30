import mongoose from 'mongoose';

import { APP_ID } from '../config/constants.js';

/**
 * A single-use password reset grant.
 *
 * Only the SHA-256 digest of the token is stored, so a database leak yields no
 * usable reset links — the same rule the Invitation model follows. `usedAt`
 * makes the token single-use even before it expires.
 */
const passwordResetTokenSchema = new mongoose.Schema(
  {
    appId: { type: String, default: APP_ID, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    // Recorded for abuse investigation, never shown to a user.
    requestedIp: { type: String, default: '' },
  },
  { timestamps: true },
);

// Mongo removes expired documents automatically, so spent tokens don't pile up.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken =
  mongoose.models.PasswordResetToken ||
  mongoose.model('PasswordResetToken', passwordResetTokenSchema);

export default PasswordResetToken;
