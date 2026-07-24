import "server-only";

import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { recordAuditEvent } from "@/lib/audit/log";
import type { Json } from "@/lib/supabase/types";
import { createEmailProvider, type EmailProvider } from "./email-provider";
import { getDefaultFromEmail } from "./support";
import {
  createServiceSupabaseClient,
  hasServiceSupabaseEnv,
  hasSupabaseEnv,
  type ServiceSupabaseClient,
} from "./supabase-service";
import {
  createUnsubscribeToken,
  notificationPreferenceVersion,
  renderReminderEmail,
  verifyUnsubscribeToken,
} from "./templates";

export { createServiceSupabaseClient, hasServiceSupabaseEnv, hasSupabaseEnv };

type DispatchReminderRow = {
  id: string;
  user_id: string;
  document_id: string;
  title: string;
  description: string;
  fire_on: string;
  sent_at: string | null;
  documents?: { title?: string | null } | { title?: string | null }[] | null;
};

type DispatchUserRow = {
  id: string;
  email?: string | null;
  notification_preferences?: Json;
};

export type DispatchResult = {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
};

export type DispatchOptions = {
  supabase?: ServiceSupabaseClient;
  provider?: EmailProvider;
  now?: Date;
  baseUrl?: string;
  from?: string;
  unsubscribeSecret?: string;
};

export async function dispatchDueReminderEmails(options: DispatchOptions = {}): Promise<DispatchResult> {
  const supabase = options.supabase ?? createServiceSupabaseClient();
  const provider = options.provider ?? createEmailProvider();
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.BASE_URL ?? "http://localhost:3000");
  const from = options.from ?? getDefaultFromEmail();
  const unsubscribeSecret = options.unsubscribeSecret ?? process.env.CLAUSLY_UNSUBSCRIBE_SECRET;

  if (!unsubscribeSecret) throw new Error("Missing CLAUSLY_UNSUBSCRIBE_SECRET.");

  const dueOn = (options.now ?? new Date()).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("reminders")
    .select("id,user_id,document_id,title,description,fire_on,sent_at,documents(title)")
    .eq("status", "approved")
    .eq("channel", "email")
    .is("sent_at", null)
    .lte("fire_on", dueOn)
    .order("fire_on", { ascending: true })
    .limit(100);

  if (error) throw new Error(error.message);

  const reminders = (data ?? []) as DispatchReminderRow[];
  const usersById = await loadDispatchUsers(supabase, reminders);
  const result: DispatchResult = { processed: 0, sent: 0, skipped: 0, failed: 0 };

  for (const reminder of reminders) {
    result.processed += 1;

    const user = usersById.get(reminder.user_id);
    const document = firstObject(reminder.documents);

    if (!user?.email || emailDisabled(user.notification_preferences)) {
      result.skipped += 1;
      continue;
    }

    try {
      const documentUrl = `${baseUrl}/dashboard/documents/${encodeURIComponent(reminder.document_id)}`;
      const unsubscribeUrl = buildUnsubscribeUrl({
        baseUrl,
        userId: reminder.user_id,
        preferences: user.notification_preferences,
        secret: unsubscribeSecret,
      });
      const template = renderReminderEmail({
        title: reminder.title,
        documentName: document?.title ?? "Untitled document",
        documentUrl,
        dueDate: reminder.fire_on,
        description: reminder.description,
        unsubscribeUrl,
      });

      await provider.send({
        to: user.email,
        from,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      const { error: updateError } = await supabase
        .from("reminders")
        .update({ sent_at: new Date().toISOString(), status: "sent" })
        .eq("id", reminder.id)
        .is("sent_at", null);

      if (updateError) throw new Error(updateError.message);
      try {
        await recordAuditEvent(supabase, {
          userId: reminder.user_id,
          action: AUDIT_ACTIONS.REMINDER_FIRED,
          resourceType: "reminder",
          resourceId: reminder.id,
          metadata: {
            documentId: reminder.document_id,
            fireOn: reminder.fire_on,
          },
        });
      } catch {
        // Audit logging is best-effort; reminder dispatch remains the source of truth.
      }
      result.sent += 1;
    } catch (error) {
      result.failed += 1;
      await logEmailFailure(supabase, reminder, error);
    }
  }

  return result;
}

async function loadDispatchUsers(supabase: ServiceSupabaseClient, reminders: DispatchReminderRow[]) {
  const userIds = Array.from(new Set(reminders.map((reminder) => reminder.user_id).filter(Boolean)));
  if (userIds.length === 0) return new Map<string, DispatchUserRow>();

  const { data, error } = await supabase
    .from("users")
    .select("id,email,notification_preferences")
    .in("id", userIds);

  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as DispatchUserRow[]).map((user) => [user.id, user]));
}

export async function unsubscribeUserEmail(options: {
  supabase?: ServiceSupabaseClient;
  userId: string;
  token: string;
  secret?: string;
}) {
  const supabase = options.supabase ?? createServiceSupabaseClient();
  const secret = options.secret ?? process.env.CLAUSLY_UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("Missing CLAUSLY_UNSUBSCRIBE_SECRET.");

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id,notification_preferences")
    .eq("id", options.userId)
    .single();

  if (userError || !user) {
    return { ok: false, status: 404, error: userError?.message ?? "User not found." };
  }

  const version = notificationPreferenceVersion(user.notification_preferences);
  if (!verifyUnsubscribeToken(options.userId, version, options.token, secret)) {
    return { ok: false, status: 400, error: "Invalid unsubscribe token." };
  }

  const preferences = objectPreferences(user.notification_preferences);
  const { error: updateError } = await supabase
    .from("users")
    .update({ notification_preferences: { ...preferences, email: false } })
    .eq("id", options.userId);

  if (updateError) {
    return { ok: false, status: 500, error: updateError.message };
  }

  return { ok: true, status: 200, error: null };
}

export function buildUnsubscribeUrl(options: {
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
  return url.toString();
}

async function logEmailFailure(supabase: ServiceSupabaseClient, reminder: DispatchReminderRow, error: unknown) {
  try {
    await supabase.from("usage_metrics").insert({
      user_id: reminder.user_id,
      document_id: reminder.document_id,
      job_type: "email",
      provider: "resend",
      model: null,
      input_token_count: 0,
      output_token_count: 0,
      status: "failed",
      error_message: error instanceof Error ? error.message : "Email dispatch failed.",
    });
  } catch (loggingError) {
    console.warn("Email failure logging failed.", loggingError);
  }
}

function emailDisabled(preferences: unknown) {
  return Boolean(preferences && typeof preferences === "object" && (preferences as { email?: unknown }).email === false);
}

function objectPreferences(preferences: unknown): Record<string, Json> {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
    return {};
  }

  return preferences as Record<string, Json>;
}

function firstObject<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
