import { isDevelopment, isTest } from '../../config/env.js';
import logger from '../../config/logger.js';
import { getEmailProvider, isEmailConfigured } from './providers.js';

/**
 * Provider-agnostic send. Every caller uses this, never a provider directly.
 *
 * Degrades instead of throwing when email is unconfigured: a missing key must
 * not break a password-reset request for everyone. In development the message is
 * logged so the flow is still testable without credentials.
 *
 * Returns { sent: boolean } — callers deliberately do NOT surface this to the
 * user, because "no email was sent" reveals whether an account exists.
 */
export async function sendEmail({ to, subject, html, text, replyTo }) {
  // The suite never sends real mail; asserting on stored tokens is enough.
  if (isTest) return { sent: false, reason: 'test' };

  if (!isEmailConfigured()) {
    if (isDevelopment) {
      logger.warn('Email not configured — message not sent. Contents below for local testing.', {
        to,
        subject,
        // Only in development, and only the plain-text part.
        preview: text,
      });
    } else {
      logger.error('Email not configured — message dropped.', { to, subject });
    }
    return { sent: false, reason: 'unconfigured' };
  }

  const provider = getEmailProvider();
  const result = await provider.send({ to, subject, html, text, replyTo });

  // Log the recipient and provider id, never the body — reset links are
  // credentials and must not land in logs.
  logger.info('Email sent', { to, subject, provider: result.provider, id: result.id });
  return { sent: true, ...result };
}

export { isEmailConfigured };
export default { sendEmail, isEmailConfigured };
