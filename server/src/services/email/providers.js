import axios from 'axios';

import { env } from '../../config/env.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../config/logger.js';

/**
 * Email provider registry — same shape as services/ai/providers.js so the two
 * read alike. Adding a provider is one entry here; every caller goes through
 * emailClient.js and never touches a provider directly.
 *
 * Resend is HTTP, so it needs no SDK and no SMTP ports open — which matters on
 * hosts that block outbound 587. An SMTP provider would need `nodemailer`; it is
 * deliberately not added until something actually requires it.
 */
const RESEND_URL = 'https://api.resend.com/emails';

const PROVIDERS = {
  resend: {
    id: 'resend',
    label: 'Resend',
    isConfigured: () => Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
    async send({ to, subject, html, text, replyTo }) {
      try {
        const response = await axios.post(
          RESEND_URL,
          {
            from: env.EMAIL_FROM,
            to: [to],
            subject,
            html,
            text,
            ...(replyTo ? { reply_to: replyTo } : {}),
          },
          {
            headers: {
              Authorization: `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 15_000,
          },
        );
        return { id: response.data?.id ?? null, provider: 'resend' };
      } catch (error) {
        const status = error.response?.status;
        // Resend puts the useful detail in `message`; surface it in the log so a
        // rejected domain or key is diagnosable without guesswork.
        const providerMessage = error.response?.data?.message;
        logger.error('Resend request failed', { status, message: error.message, providerMessage });

        if (status === 401 || status === 403) {
          throw new ApiError(502, 'The email service rejected our credentials.', {
            code: 'EMAIL_AUTH_FAILED',
            errors: providerMessage ? [{ field: 'RESEND_API_KEY', message: providerMessage }] : [],
          });
        }
        if (status === 422) {
          // Almost always an unverified sending domain or a malformed address.
          throw new ApiError(502, 'The email service rejected this message.', {
            code: 'EMAIL_REJECTED',
            errors: providerMessage ? [{ field: 'EMAIL_FROM', message: providerMessage }] : [],
          });
        }
        throw new ApiError(502, 'Could not send the email. Please try again.', {
          code: 'EMAIL_SEND_FAILED',
          cause: error,
        });
      }
    },
  },
};

export function getEmailProvider() {
  return PROVIDERS[env.EMAIL_PROVIDER];
}

/** True when the active provider has everything it needs to send. */
export function isEmailConfigured() {
  const provider = getEmailProvider();
  return Boolean(provider?.isConfigured());
}

export default { getEmailProvider, isEmailConfigured };
