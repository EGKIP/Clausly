import { createHmac, timingSafeEqual } from "node:crypto";

export type ReminderEmailTemplateInput = {
  title: string;
  documentName: string;
  documentUrl: string;
  dueDate: string;
  description: string;
  unsubscribeUrl: string;
};

export type ReminderEmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

export function renderReminderEmail(input: ReminderEmailTemplateInput): ReminderEmailTemplate {
  validateTemplateInput(input);

  const subject = `Reminder: ${input.title}`;
  const dueDate = formatDueDate(input.dueDate);
  const html = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
    <h1 style="font-size: 20px;">${escapeHtml(input.title)}</h1>
    <p><strong>Document:</strong> <a href="${escapeAttribute(input.documentUrl)}">${escapeHtml(input.documentName)}</a></p>
    <p><strong>Due date:</strong> ${escapeHtml(dueDate)}</p>
    <p>${escapeHtml(input.description)}</p>
    <p><a href="${escapeAttribute(input.documentUrl)}">Open document in Clausly</a></p>
    <p style="font-size: 13px; color: #4b5563;">This reminder is informational only and is not legal advice.</p>
    <p style="font-size: 13px;"><a href="${escapeAttribute(input.unsubscribeUrl)}">Unsubscribe from email reminders</a></p>
  </body>
</html>`;

  const text = [
    input.title,
    `Document: ${input.documentName}`,
    `Due date: ${dueDate}`,
    input.description,
    `Document URL: ${input.documentUrl}`,
    "This reminder is informational only and is not legal advice.",
    `Unsubscribe: ${input.unsubscribeUrl}`,
  ].join("\n\n");

  return { subject, html, text };
}

export function createUnsubscribeToken(userId: string, version: string | number, secret: string) {
  if (!userId || version === "" || version === null || version === undefined || !secret) {
    throw new Error("Missing unsubscribe token input.");
  }

  return createHmac("sha256", secret).update(`${userId}${version}`).digest("hex");
}

export function verifyUnsubscribeToken(userId: string, version: string | number, token: string, secret: string) {
  if (!token) return false;

  const expected = createUnsubscribeToken(userId, version, secret);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(token, "hex");

  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function notificationPreferenceVersion(preferences: unknown) {
  if (preferences && typeof preferences === "object" && "version" in preferences) {
    const version = (preferences as { version?: unknown }).version;
    if (typeof version === "string" || typeof version === "number") return version;
  }

  return 1;
}

function validateTemplateInput(input: ReminderEmailTemplateInput) {
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`Missing required reminder email field: ${key}.`);
    }
  }
}

function formatDueDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) return value;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
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
