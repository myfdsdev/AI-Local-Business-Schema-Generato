import { APP_ID } from '../../config/constants.js';
import { env } from '../../config/env.js';
import logger from '../../config/logger.js';
import { PasswordResetToken, User } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { DURATIONS, addDuration, generateRawToken, hashToken } from '../../utils/tokens.js';
import { sendEmail } from '../email/emailClient.js';
import { passwordResetEmail } from '../email/templates.js';

const TOKEN_TTL_MS = DURATIONS.HOUR; // 60 minutes
const EXPIRES_IN_MINUTES = TOKEN_TTL_MS / DURATIONS.MINUTE;

const clientUrl = () => env.CLIENT_URL?.replace(/\/$/, '') ?? '';

/**
 * Starts a reset.
 *
 * ALWAYS resolves, whether or not the address belongs to an account. Telling the
 * caller "no such user" turns this endpoint into a way to enumerate customers,
 * so the controller returns the same response either way.
 */
export async function requestPasswordReset({ email, ip }) {
  const normalized = String(email ?? '').toLowerCase().trim();
  const user = await User.findOne({ email: normalized });

  if (!user) {
    // Logged for support, never surfaced to the caller.
    logger.info('Password reset requested for unknown address', { email: normalized });
    return { sent: false };
  }

  // Any earlier outstanding token becomes useless: a new request must invalidate
  // the old link, or a forwarded email stays live.
  await PasswordResetToken.deleteMany({ appId: APP_ID, userId: user._id, usedAt: null });

  const rawToken = generateRawToken(32);
  await PasswordResetToken.create({
    appId: APP_ID,
    userId: user._id,
    tokenHash: hashToken(rawToken),
    expiresAt: addDuration(new Date(), TOKEN_TTL_MS),
    requestedIp: ip ?? '',
  });

  const resetUrl = `${clientUrl()}/reset-password?token=${rawToken}`;
  const message = passwordResetEmail({
    name: user.name,
    resetUrl,
    expiresInMinutes: EXPIRES_IN_MINUTES,
  });

  await sendEmail({
    to: user.email,
    replyTo: env.EMAIL_REPLY_TO,
    ...message,
  });

  return { sent: true };
}

/**
 * Completes a reset. Deliberately vague on failure — an expired, spent, and
 * fabricated token all produce the same message, so nothing can be probed.
 */
export async function resetPassword({ token, password }) {
  const invalid = () =>
    ApiError.badRequest('This reset link is invalid or has expired. Request a new one.', {
      code: 'RESET_TOKEN_INVALID',
    });

  if (!token) throw invalid();

  const record = await PasswordResetToken.findOne({
    appId: APP_ID,
    tokenHash: hashToken(token),
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) throw invalid();

  const user = await User.findById(record.userId);
  if (!user) throw invalid();

  user.password = password;
  // Invalidates every existing refresh token, so sessions opened by whoever had
  // the old password are cut off — the point of a reset.
  user.tokenVersion += 1;
  await user.save();

  // Single use: mark spent, and clear any siblings.
  record.usedAt = new Date();
  await record.save();
  await PasswordResetToken.deleteMany({
    appId: APP_ID,
    userId: user._id,
    usedAt: null,
  });

  logger.info('Password reset completed', { userId: String(user._id) });
  return { user };
}

export default { requestPasswordReset, resetPassword };
