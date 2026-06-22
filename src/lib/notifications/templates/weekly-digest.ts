import { createUnsubscribeToken, notificationPreferenceVersion } from "./reminder-email";

export type WeeklyDigestTemplateInput = {
  userName: string;
  dashboardUrl: string;
  unsubscribeUrl: string;
  deadlinesThisWeek: DigestReminder[];
  deadlinesNext30: DigestReminder[];
  recentUploads: DigestDocument[];
  newHighRiskClauses: DigestClause[];
};

export type DigestReminder = {
  title: string;
  documentTitle: string;
  fireOn: string;
  description: string;
  documentUrl: string;
};

export type DigestDocument = {
  title: string;
  documentType: string;
  createdAt: string;
  documentUrl: string;
};

export type DigestClause = {
  title: string;
  documentTitle: string;
  riskLevel: "high" | "needs_review";
  pageNumber: number;
  sourceQuote: string;
  documentUrl: string;
};

export type WeeklyDigestTemplate = {
  subject: string;
  html: string;
  text: string;
};

export function renderWeeklyDigestEmail(input: WeeklyDigestTemplateInput): WeeklyDigestTemplate {
  const subject = "Your Clausly weekly contract digest";
  const greeting = input.userName ? `Hi ${input.userName},` : "Hi,";
  const html = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5; margin: 0; padding: 0; background: #f7f2e8;">
    <div style="max-width: 640px; margin: 0 auto; padding: 28px 18px;">
      <div style="background: #ffffff; border: 1px solid #e6ded1; border-radius: 16px; overflow: hidden;">
        <div style="padding: 26px 28px 18px; border-bottom: 1px solid #e6ded1;">
          <p style="margin: 0 0 8px; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #0f766e;">Clausly Pro</p>
          <h1 style="margin: 0; font-size: 24px; line-height: 1.2; color: #111827;">Your weekly contract digest</h1>
          <p style="margin: 12px 0 0; color: #4b5563;">${escapeHtml(greeting)} here is what needs attention across your portfolio this week.</p>
        </div>
        <div style="padding: 22px 28px;">
          ${renderReminderSection("Due this week", input.deadlinesThisWeek)}
          ${renderReminderSection("Coming in the next 30 days", input.deadlinesNext30)}
          ${renderDocumentSection("Recent uploads", input.recentUploads)}
          ${renderClauseSection("New high-risk clauses", input.newHighRiskClauses)}
          <p style="margin: 22px 0 0;"><a href="${escapeAttribute(input.dashboardUrl)}" style="color: #0f766e;">Open your Clausly dashboard</a></p>
        </div>
        <div style="padding: 18px 28px; border-top: 1px solid #e6ded1; color: #4b5563; font-size: 13px;">
          <p style="margin: 0 0 10px;">This digest is informational only and is not legal advice.</p>
          <p style="margin: 0;"><a href="${escapeAttribute(input.unsubscribeUrl)}" style="color: #4b5563;">Unsubscribe from weekly digests</a></p>
        </div>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    "Your weekly contract digest",
    greeting,
    textReminderSection("Due this week", input.deadlinesThisWeek),
    textReminderSection("Coming in the next 30 days", input.deadlinesNext30),
    textDocumentSection("Recent uploads", input.recentUploads),
    textClauseSection("New high-risk clauses", input.newHighRiskClauses),
    `Dashboard: ${input.dashboardUrl}`,
    "This digest is informational only and is not legal advice.",
    `Unsubscribe: ${input.unsubscribeUrl}`,
  ].filter(Boolean).join("\n\n");

  return { subject, html, text };
}

export function buildWeeklyDigestUnsubscribeUrl(options: {
  baseUrl: string;
  userId: string;
  preferences: unknown;
  secret: string;
}) {
  const version = notificationPreferenceVersion(options.preferences);
  const token = createUnsubscribeToken(options.userId, version, options.secret);
  const url = new URL("/api/notifications/unsubscribe", normalizeBaseUrl(options.baseUrl));
  url.searchParams.set("user_id", options.userId);
  url.searchParams.set("token", token);
  url.searchParams.set("type", "weekly_digest");
  return url.toString();
}

function renderReminderSection(title: string, items: DigestReminder[]) {
  if (items.length === 0) return "";
  return renderSection(title, items.map((item) => `
    <li style="margin: 0 0 14px;">
      <strong>${escapeHtml(item.title)}</strong><br />
      <span style="color: #4b5563;">${escapeHtml(item.documentTitle)} · ${escapeHtml(formatDate(item.fireOn))}</span><br />
      <span>${escapeHtml(item.description)}</span><br />
      <a href="${escapeAttribute(item.documentUrl)}" style="color: #0f766e;">Open document</a>
    </li>`).join(""));
}

function renderDocumentSection(title: string, items: DigestDocument[]) {
  if (items.length === 0) return "";
  return renderSection(title, items.map((item) => `
    <li style="margin: 0 0 12px;">
      <strong>${escapeHtml(item.title)}</strong><br />
      <span style="color: #4b5563;">${escapeHtml(item.documentType)} · uploaded ${escapeHtml(formatDate(item.createdAt))}</span><br />
      <a href="${escapeAttribute(item.documentUrl)}" style="color: #0f766e;">Open document</a>
    </li>`).join(""));
}

function renderClauseSection(title: string, items: DigestClause[]) {
  if (items.length === 0) return "";
  return renderSection(title, items.map((item) => `
    <li style="margin: 0 0 14px;">
      <strong>${escapeHtml(item.title)}</strong><br />
      <span style="color: #4b5563;">${escapeHtml(item.documentTitle)} · p. ${item.pageNumber} · ${escapeHtml(formatRisk(item.riskLevel))}</span><br />
      <span style="font-style: italic;">&ldquo;${escapeHtml(item.sourceQuote)}&rdquo;</span><br />
      <a href="${escapeAttribute(item.documentUrl)}" style="color: #0f766e;">Open document</a>
    </li>`).join(""));
}

function renderSection(title: string, listItems: string) {
  return `
    <section style="margin: 0 0 24px;">
      <h2 style="margin: 0 0 10px; font-size: 16px; color: #111827;">${escapeHtml(title)}</h2>
      <ul style="padding-left: 18px; margin: 0;">${listItems}</ul>
    </section>`;
}

function textReminderSection(title: string, items: DigestReminder[]) {
  if (items.length === 0) return "";
  return `${title}\n${items.map((item) =>
    `- ${item.title} (${item.documentTitle}, ${formatDate(item.fireOn)}): ${item.description}`
  ).join("\n")}`;
}

function textDocumentSection(title: string, items: DigestDocument[]) {
  if (items.length === 0) return "";
  return `${title}\n${items.map((item) =>
    `- ${item.title} (${item.documentType}, uploaded ${formatDate(item.createdAt)})`
  ).join("\n")}`;
}

function textClauseSection(title: string, items: DigestClause[]) {
  if (items.length === 0) return "";
  return `${title}\n${items.map((item) =>
    `- ${item.title} (${item.documentTitle}, p. ${item.pageNumber}, ${formatRisk(item.riskLevel)}): "${item.sourceQuote}"`
  ).join("\n")}`;
}

function formatDate(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function formatRisk(value: "high" | "needs_review") {
  return value === "needs_review" ? "Needs review" : "High risk";
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
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
