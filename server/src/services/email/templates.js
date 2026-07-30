import { env } from '../../config/env.js';

/**
 * Transactional email templates. Inline styles only — every mail client strips
 * <style> blocks, and several ignore <head> entirely. Table-free layout keeps it
 * readable in Outlook too.
 *
 * Each template returns { subject, html, text }. The text part is not optional:
 * some clients show it, and spam filters score HTML-only mail worse.
 */
const BRAND = '#05524F';
const APP_NAME = env.APP_NAME;

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Shared shell so every message looks like it came from the same product. */
function layout({ heading, bodyHtml, cta }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
      <div style="font-size:18px;font-weight:700;color:${BRAND};margin-bottom:24px;">${escapeHtml(APP_NAME)}</div>
      <div style="background:#ffffff;border-radius:12px;padding:32px;">
        <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">${escapeHtml(heading)}</h1>
        ${bodyHtml}
        ${
          cta
            ? `<a href="${cta.url}" style="display:inline-block;margin:24px 0 8px;background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px;">${escapeHtml(cta.label)}</a>
        <p style="margin:16px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
          If the button doesn't work, copy this link into your browser:<br />
          <span style="color:#475569;word-break:break-all;">${cta.url}</span>
        </p>`
            : ''
        }
      </div>
      <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
        Sent by ${escapeHtml(APP_NAME)}. If you weren't expecting this, you can ignore it.
      </p>
    </div>
  </body>
</html>`;
}

export function passwordResetEmail({ name, resetUrl, expiresInMinutes }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';

  return {
    subject: `Reset your ${APP_NAME} password`,
    html: layout({
      heading: 'Reset your password',
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.6;">${escapeHtml(greeting)}</p>
        <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;">
          Someone asked to reset the password for this email address. Click below to choose a new one.
          This link expires in ${expiresInMinutes} minutes and can only be used once.
        </p>`,
      cta: { url: resetUrl, label: 'Choose a new password' },
    }),
    text: `${greeting}

Someone asked to reset the password for your ${APP_NAME} account.

Open this link to choose a new password (expires in ${expiresInMinutes} minutes, single use):
${resetUrl}

If you didn't request this, ignore this email — your password has not changed.`,
  };
}

export function teamInviteEmail({ inviterName, workspaceName, role, joinUrl }) {
  const who = inviterName ? escapeHtml(inviterName) : 'A workspace owner';
  const where = workspaceName ? escapeHtml(workspaceName) : 'their workspace';

  return {
    subject: `You've been invited to ${APP_NAME}`,
    html: layout({
      heading: 'You’ve been invited',
      bodyHtml: `
        <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;">
          ${who} invited you to join <strong>${where}</strong> on ${escapeHtml(APP_NAME)} as
          <strong>${escapeHtml(role)}</strong>. Accept the invitation to set your password and get access.
        </p>`,
      cta: { url: joinUrl, label: 'Accept invitation' },
    }),
    text: `${inviterName || 'A workspace owner'} invited you to join ${workspaceName || 'their workspace'} on ${APP_NAME} as ${role}.

Accept the invitation and set your password:
${joinUrl}`,
  };
}

export default { passwordResetEmail, teamInviteEmail };
