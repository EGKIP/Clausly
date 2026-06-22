import "server-only";

import type { Json } from "@/lib/supabase/types";
import type { ServiceSupabaseClient } from "./supabase-service";

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

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
