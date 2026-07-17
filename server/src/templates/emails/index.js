import { button, escapeHtml, fallbackLink, renderLayout } from './layout.js';

export function verificationEmail({ name, verifyUrl }) {
  return {
    subject: 'Verify your LocalSchema AI email address',
    html: renderLayout({
      title: 'Verify your email address',
      previewText: 'Confirm your email to finish setting up your account.',
      bodyHtml: `
        <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 16px;">Confirm your email address to finish setting up your LocalSchema AI account.</p>
        ${button(verifyUrl, 'Verify email address')}
        <p style="margin:0;color:#64748b;font-size:13px;">This link expires in 24 hours.</p>
        ${fallbackLink(verifyUrl)}
      `,
    }),
    text: `Hi ${name},\n\nConfirm your email address to finish setting up your LocalSchema AI account:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
  };
}

export function passwordResetEmail({ name, resetUrl }) {
  return {
    subject: 'Reset your LocalSchema AI password',
    html: renderLayout({
      title: 'Reset your password',
      previewText: 'Choose a new password for your account.',
      bodyHtml: `
        <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 16px;">We received a request to reset your password. Choose a new one using the link below.</p>
        ${button(resetUrl, 'Reset password')}
        <p style="margin:0;color:#64748b;font-size:13px;">This link expires in 1 hour and can only be used once. If you didn't request this, no action is needed — your password stays unchanged.</p>
        ${fallbackLink(resetUrl)}
      `,
    }),
    text: `Hi ${name},\n\nReset your LocalSchema AI password:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request it, ignore this email.`,
  };
}

export function passwordChangedEmail({ name }) {
  return {
    subject: 'Your LocalSchema AI password was changed',
    html: renderLayout({
      title: 'Password changed',
      previewText: 'Your password was changed.',
      bodyHtml: `
        <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 16px;">Your password was just changed, and every other signed-in session has been ended.</p>
        <p style="margin:0;color:#64748b;font-size:13px;">If this wasn't you, reset your password immediately and contact support.</p>
      `,
    }),
    text: `Hi ${name},\n\nYour LocalSchema AI password was just changed and all other sessions were signed out.\n\nIf this wasn't you, reset your password immediately.`,
  };
}

export function welcomeEmail({ name }) {
  return {
    subject: 'Welcome to LocalSchema AI',
    html: renderLayout({
      title: 'Welcome to LocalSchema AI',
      previewText: 'Your email is verified. Create your first project.',
      bodyHtml: `
        <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 16px;">Your email is verified. You can now scan a website and generate accurate structured data that helps search engines understand your local business.</p>
        <p style="margin:0;color:#64748b;font-size:13px;">Start by creating your first project from the dashboard.</p>
      `,
    }),
    text: `Hi ${name},\n\nYour email is verified. Create your first project from the dashboard to scan a website and generate structured data.`,
  };
}
