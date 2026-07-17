import nodemailer from 'nodemailer';

import { env, isTest } from '../../config/env.js';
import logger from '../../config/logger.js';
import {
  passwordChangedEmail,
  passwordResetEmail,
  verificationEmail,
  welcomeEmail,
} from '../../templates/emails/index.js';

let transporter = null;

function getTransporter() {
  if (!env.EMAIL_ENABLED) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  return transporter;
}

/**
 * With EMAIL_ENABLED=false the link is logged instead of sent, so local
 * development needs no SMTP server. Delivery failures are logged rather than
 * thrown: a dead mail server must not roll back a completed registration.
 */
async function send({ to, subject, html, text }) {
  if (!env.EMAIL_ENABLED) {
    if (!isTest) logger.info(`[email:dev] "${subject}" -> ${to}\n${text}`);
    return { delivered: false, reason: 'email_disabled' };
  }

  try {
    const info = await getTransporter().sendMail({ from: env.EMAIL_FROM, to, subject, html, text });
    logger.info('Email sent', { to, subject, messageId: info.messageId });
    return { delivered: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Email delivery failed', { to, subject, message: error.message });
    return { delivered: false, reason: error.message };
  }
}

export function buildVerifyUrl(token) {
  return `${env.CLIENT_URL}/verify-email?token=${encodeURIComponent(token)}`;
}

export function buildResetUrl(token) {
  return `${env.CLIENT_URL}/reset-password?token=${encodeURIComponent(token)}`;
}

export function sendVerificationEmail({ to, name, token }) {
  return send({ to, ...verificationEmail({ name, verifyUrl: buildVerifyUrl(token) }) });
}

export function sendPasswordResetEmail({ to, name, token }) {
  return send({ to, ...passwordResetEmail({ name, resetUrl: buildResetUrl(token) }) });
}

export function sendPasswordChangedEmail({ to, name }) {
  return send({ to, ...passwordChangedEmail({ name }) });
}

export function sendWelcomeEmail({ to, name }) {
  return send({ to, ...welcomeEmail({ name }) });
}

export default { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedEmail, sendWelcomeEmail };
