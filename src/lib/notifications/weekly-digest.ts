import "server-only";

import { getUserPlan } from "@/lib/billing/plan";
import type { Json } from "@/lib/supabase/types";
import { createEmailProvider, type EmailProvider } from "./email-provider";
import type { ServiceSupabaseClient } from "./supabase-service";
import { createServiceSupabaseClient } from "./supabase-service";
import {
  buildWeeklyDigestUnsubscribeUrl,
  renderWeeklyDigestEmail,
  type DigestClause,
  type DigestDocument,
  type DigestReminder,
} from "./templates";

export type WeeklyDigestUser = {
  id: string;
  email: string;
  name: string | null;
  notificationPreferences: Json;
};

export type WeeklyDigestReminder = {
  id: string;
  title: string;
  description: string;
  fireOn: string;
  documentId: string;
  documentTitle: string;
};

export type WeeklyDigestDocument = {
  id: string;
  title: string;
  documentType: string;
  createdAt: string;
};

export type WeeklyDigestClause = {
  id: string;
  title: string;
  documentId: string;
  documentTitle: string;
  riskLevel: "high" | "needs_review";
  pageNumber: number;
  sourceQuote: string;
  createdAt: string;
};

export type WeeklyDigest = {
  user: WeeklyDigestUser;
  deadlinesThisWeek: WeeklyDigestReminder[];
  deadlinesNext30: WeeklyDigestReminder[];
  recentUploads: WeeklyDigestDocument[];
  newHighRiskClauses: WeeklyDigestClause[];
};

export type WeeklyDigestSendResult = {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
};

export type WeeklyDigestSendOptions = {
  provider?: EmailProvider;
  now?: Date;
  baseUrl?: string;
  from?: string;
  unsubscribeSecret?: string;
};

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  notification_preferences: Json;
  weekly_digest_sent_at: string | null;
};

type ReminderRow = {
  id: string;
  title: string;
  description: string;
  fire_on: string;
  document_id: string;
};

type DocumentRow = {
  id: string;
  title: string;
  document_type: string;
  created_at: string;
};

type ClauseRow = {
  id: string;
  title: string;
  document_id: string;
  risk_level: "high" | "needs_review";
  page_number: number;
  source_quote: string;
  created_at: string;
};

export async function buildDigestForUser(
  supabase: ServiceSupabaseClient,
  userId: string,
  now = new Date()
): Promise<WeeklyDigest> {
  const windowStart = now.toISOString();
  const today = isoDate(now);
  const weekEndDate = isoDate(addDays(now, 7));
  const thirtyDayEndDate = isoDate(addDays(now, 30));

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id,email,full_name,notification_preferences,weekly_digest_sent_at")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error(userError?.message ?? "User not found.");
  }

  const typedUser = user as UserRow;
  const clauseCutoff = typedUser.weekly_digest_sent_at ?? addDays(now, -7).toISOString();

  const [
    thisWeekResult,
    next30Result,
    uploadsResult,
    clausesResult,
    documentsResult,
  ] = await Promise.all([
    supabase
      .from("reminders")
      .select("id,title,description,fire_on,document_id")
      .eq("user_id", userId)
      .eq("status", "approved")
      .gte("fire_on", today)
      .lt("fire_on", weekEndDate)
      .order("fire_on", { ascending: true }),
    supabase
      .from("reminders")
      .select("id,title,description,fire_on,document_id")
      .eq("user_id", userId)
      .eq("status", "approved")
      .gte("fire_on", weekEndDate)
      .lt("fire_on", thirtyDayEndDate)
      .order("fire_on", { ascending: true }),
    supabase
      .from("documents")
      .select("id,title,document_type,created_at")
      .eq("user_id", userId)
      .gte("created_at", addDays(now, -7).toISOString())
      .lt("created_at", windowStart)
      .order("created_at", { ascending: false }),
    supabase
      .from("clauses")
      .select("id,title,document_id,risk_level,page_number,source_quote,created_at")
      .eq("user_id", userId)
      .in("risk_level", ["high", "needs_review"])
      .gte("created_at", clauseCutoff)
      .lt("created_at", windowStart)
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("id,title,document_type,created_at")
      .eq("user_id", userId),
  ]);

  for (const result of [thisWeekResult, next30Result, uploadsResult, clausesResult, documentsResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const documents = ((documentsResult.data ?? []) as DocumentRow[]);
  const titlesByDocument = new Map(documents.map((document) => [document.id, document.title]));

  return {
    user: {
      id: typedUser.id,
      email: typedUser.email ?? "",
      name: typedUser.full_name,
      notificationPreferences: typedUser.notification_preferences,
    },
    deadlinesThisWeek: ((thisWeekResult.data ?? []) as ReminderRow[]).map((reminder) =>
      toDigestReminder(reminder, titlesByDocument)
    ),
    deadlinesNext30: ((next30Result.data ?? []) as ReminderRow[]).map((reminder) =>
      toDigestReminder(reminder, titlesByDocument)
    ),
    recentUploads: ((uploadsResult.data ?? []) as DocumentRow[]).map((document) => ({
      id: document.id,
      title: document.title,
      documentType: document.document_type,
      createdAt: document.created_at,
    })),
    newHighRiskClauses: ((clausesResult.data ?? []) as ClauseRow[]).map((clause) => ({
      id: clause.id,
      title: clause.title,
      documentId: clause.document_id,
      documentTitle: titlesByDocument.get(clause.document_id) ?? "Untitled document",
      riskLevel: clause.risk_level,
      pageNumber: clause.page_number,
      sourceQuote: clause.source_quote,
      createdAt: clause.created_at,
    })),
  };
}

export async function sendWeeklyDigests(
  supabase: ServiceSupabaseClient = createServiceSupabaseClient(),
  options: WeeklyDigestSendOptions = {}
): Promise<WeeklyDigestSendResult> {
  const provider = options.provider ?? createEmailProvider();
  const now = options.now ?? new Date();
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.BASE_URL ?? "http://localhost:3000");
  const from = options.from ?? process.env.CLAUSLY_EMAIL_FROM;
  const unsubscribeSecret = options.unsubscribeSecret ?? process.env.CLAUSLY_UNSUBSCRIBE_SECRET;

  if (!from) throw new Error("Missing CLAUSLY_EMAIL_FROM.");
  if (!unsubscribeSecret) throw new Error("Missing CLAUSLY_UNSUBSCRIBE_SECRET.");

  const { data, error } = await supabase
    .from("users")
    .select("id,email,full_name,notification_preferences")
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) throw new Error(error.message);

  const result: WeeklyDigestSendResult = { processed: 0, sent: 0, skipped: 0, failed: 0 };

  for (const user of ((data ?? []) as UserRow[])) {
    const plan = await getUserPlan(supabase, user.id);
    if (plan !== "pro" || !user.email || weeklyDigestDisabled(user.notification_preferences)) {
      continue;
    }

    result.processed += 1;

    try {
      const digest = await buildDigestForUser(supabase, user.id, now);
      const counts = digestCounts(digest);

      if (isEmptyDigest(counts)) {
        await insertDigestAudit(supabase, user.id, counts, "skipped");
        result.skipped += 1;
        continue;
      }

      const template = renderWeeklyDigestEmail({
        userName: digest.user.name ?? "",
        dashboardUrl: `${baseUrl}/dashboard`,
        unsubscribeUrl: buildWeeklyDigestUnsubscribeUrl({
          baseUrl,
          userId: user.id,
          preferences: user.notification_preferences,
          secret: unsubscribeSecret,
        }),
        deadlinesThisWeek: digest.deadlinesThisWeek.map((reminder) => toTemplateReminder(reminder, baseUrl)),
        deadlinesNext30: digest.deadlinesNext30.map((reminder) => toTemplateReminder(reminder, baseUrl)),
        recentUploads: digest.recentUploads.map((document) => toTemplateDocument(document, baseUrl)),
        newHighRiskClauses: digest.newHighRiskClauses.map((clause) => toTemplateClause(clause, baseUrl)),
      });

      await provider.send({
        to: user.email,
        from,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      await insertDigestAudit(supabase, user.id, counts, "sent");
      const { error: updateError } = await supabase
        .from("users")
        .update({ weekly_digest_sent_at: now.toISOString() })
        .eq("id", user.id);
      if (updateError) throw new Error(updateError.message);

      result.sent += 1;
    } catch (error) {
      result.failed += 1;
      const message = error instanceof Error ? error.message : "Weekly digest failed.";
      await insertDigestAudit(supabase, user.id, { deadlineCount: 0, uploadCount: 0, highRiskCount: 0 }, "failed", message);
    }
  }

  return result;
}

function toDigestReminder(reminder: ReminderRow, titlesByDocument: Map<string, string>): WeeklyDigestReminder {
  return {
    id: reminder.id,
    title: reminder.title,
    description: reminder.description,
    fireOn: reminder.fire_on,
    documentId: reminder.document_id,
    documentTitle: titlesByDocument.get(reminder.document_id) ?? "Untitled document",
  };
}

function toTemplateReminder(reminder: WeeklyDigestReminder, baseUrl: string): DigestReminder {
  return {
    title: reminder.title,
    documentTitle: reminder.documentTitle,
    fireOn: reminder.fireOn,
    description: reminder.description,
    documentUrl: `${baseUrl}/dashboard/documents/${encodeURIComponent(reminder.documentId)}`,
  };
}

function toTemplateDocument(document: WeeklyDigestDocument, baseUrl: string): DigestDocument {
  return {
    title: document.title,
    documentType: document.documentType,
    createdAt: document.createdAt,
    documentUrl: `${baseUrl}/dashboard/documents/${encodeURIComponent(document.id)}`,
  };
}

function toTemplateClause(clause: WeeklyDigestClause, baseUrl: string): DigestClause {
  return {
    title: clause.title,
    documentTitle: clause.documentTitle,
    riskLevel: clause.riskLevel,
    pageNumber: clause.pageNumber,
    sourceQuote: clause.sourceQuote,
    documentUrl: `${baseUrl}/dashboard/documents/${encodeURIComponent(clause.documentId)}?clause=${encodeURIComponent(clause.id)}`,
  };
}

function digestCounts(digest: WeeklyDigest) {
  return {
    deadlineCount: digest.deadlinesThisWeek.length + digest.deadlinesNext30.length,
    uploadCount: digest.recentUploads.length,
    highRiskCount: digest.newHighRiskClauses.length,
  };
}

function isEmptyDigest(counts: { deadlineCount: number; uploadCount: number; highRiskCount: number }) {
  return counts.deadlineCount === 0 && counts.uploadCount === 0 && counts.highRiskCount === 0;
}

async function insertDigestAudit(
  supabase: ServiceSupabaseClient,
  userId: string,
  counts: { deadlineCount: number; uploadCount: number; highRiskCount: number },
  status: "sent" | "failed" | "skipped",
  errorMessage?: string
) {
  const { error } = await supabase.from("weekly_digests").insert({
    user_id: userId,
    deadline_count: counts.deadlineCount,
    upload_count: counts.uploadCount,
    high_risk_count: counts.highRiskCount,
    status,
    error_message: errorMessage ? truncate(errorMessage, 500) : null,
  });
  if (error) throw new Error(error.message);
}

function weeklyDigestDisabled(preferences: unknown) {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) return false;
  const typed = preferences as { email?: unknown; weekly_digest?: unknown };
  return typed.email === false || typed.weekly_digest === false;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}
