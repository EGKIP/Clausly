import { getSupportEmail } from "../support";

export type WelcomeEmailTemplateInput = {
  userName: string;
  dashboardUrl: string;
  preferencesUrl: string;
  supportEmail?: string;
};

export type WelcomeEmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

export function renderWelcomeEmail(input: WelcomeEmailTemplateInput): WelcomeEmailTemplate {
  validateTemplateInput(input);

  const supportEmail = input.supportEmail ?? getSupportEmail();
  const subject = "Welcome to Clausly";
  const html = `<!doctype html>
<html>
  <body style="margin:0; background:#f7f4ef; font-family: Arial, sans-serif; color:#1f2937; line-height:1.55;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ef; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px; background:#ffffff; border:1px solid #e5e0d8; border-radius:18px; overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 12px;">
                <p style="margin:0 0 12px; color:#7c5f3f; font-size:13px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;">Clausly</p>
                <h1 style="margin:0; font-size:28px; line-height:1.15; color:#171717;">Welcome, ${escapeHtml(input.userName)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0;">
                <p style="margin:0 0 16px;">Your workspace is ready. Clausly helps you keep contracts, risks, renewal dates, and approved reminders in one organized place.</p>
                <p style="margin:0 0 16px;">We will not spam you. You will receive product email only for things that matter, such as reminders you approve, account notices, and the preferences you choose.</p>
                <p style="margin:0 0 24px;">If anything feels unclear, reply to this email or reach us at <a href="mailto:${escapeAttribute(supportEmail)}" style="color:#6f4f28;">${escapeHtml(supportEmail)}</a>.</p>
                <p style="margin:0 0 26px;">
                  <a href="${escapeAttribute(input.dashboardUrl)}" style="display:inline-block; background:#171717; color:#ffffff; text-decoration:none; padding:12px 18px; border-radius:10px; font-weight:700;">Open your dashboard</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 28px; border-top:1px solid #eee8df;">
                <p style="margin:0 0 8px; font-size:13px; color:#5f6368;">You can adjust email preferences any time in settings.</p>
                <p style="margin:0; font-size:13px;"><a href="${escapeAttribute(input.preferencesUrl)}" style="color:#6f4f28;">Manage notification preferences</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Welcome, ${input.userName}`,
    "Your workspace is ready. Clausly helps you keep contracts, risks, renewal dates, and approved reminders in one organized place.",
    "We will not spam you. You will receive product email only for things that matter, such as reminders you approve, account notices, and the preferences you choose.",
    `Open your dashboard: ${input.dashboardUrl}`,
    `Manage notification preferences: ${input.preferencesUrl}`,
    `Support: ${supportEmail}`,
  ].join("\n\n");

  return { subject, html, text };
}

function validateTemplateInput(input: WelcomeEmailTemplateInput) {
  for (const [key, value] of Object.entries(input)) {
    if (key === "supportEmail" && value === undefined) continue;
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`Missing required welcome email field: ${key}.`);
    }
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
