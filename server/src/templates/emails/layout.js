const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Any user-supplied value interpolated into an email body must go through this. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => escapeMap[char]);
}

export function renderLayout({ title, previewText = '', bodyHtml }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none;font-size:1px;color:#f8fafc;max-height:0;overflow:hidden;">${escapeHtml(previewText)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid #e2e8f0;">
                <span style="font-size:16px;font-weight:600;color:#1e293b;letter-spacing:-0.01em;">LocalSchema AI</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#334155;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.5;">
                You received this email because an account was created at LocalSchema AI with this address.
                If this wasn't you, you can safely ignore it.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function button(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="border-radius:8px;background-color:#4f46e5;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:15px;font-weight:500;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

export function fallbackLink(href) {
  return `<p style="margin:16px 0 0;color:#64748b;font-size:13px;line-height:1.5;">
  If the button doesn't work, paste this link into your browser:<br />
  <a href="${escapeHtml(href)}" style="color:#4f46e5;word-break:break-all;">${escapeHtml(href)}</a>
</p>`;
}
