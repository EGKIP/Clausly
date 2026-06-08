import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { createEmailProvider, type EmailProvider } from "./email-provider";
import {
  createUnsubscribeToken,
  notificationPreferenceVersion,
  renderReminderEmail,
  verifyUnsubscribeToken,
} from "./templates";

type SupabaseClient = ReturnType<typeof createSupabaseClient<Database>>;

type DispatchReminderRow = {
  id: string;
  user_id: string;
  document_id: string;
  title: string;
  description: string;
  fire_on: string;
  sent_at: string | null;
  documents?: { title?: string | null } | { title?: string | null }[] | null;
  users?: {
    email?: string | null;
    notification_preferences?: Json;
  } | {
    email?: string | null;
    notification_preferences?: Json;
  }[] | null;
};

export type DispatchResult = {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
};

export type DispatchOptions = {
  supabase?: SupabaseClient;
  provider?: EmailProvider;
  now?: Date;
  baseUrl?: string;
  from?: string;
  unsubscribeSecret?: string;
};

export function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function hasServiceSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function dispatchDueReminderEmails(options: DispatchOptions = {}): Promise<DispatchResult> {
  const supabase = options.supabase ?? createServiceSupabaseClient();
  const provider = options.provider ?? createEmailProvider();
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.BASE_URL ?? "http://localhost:3000");
  const from = options.from ?? process.env.CLAUSLY_EMAIL_FROM;
  const unsubscribeSecret = options.unsubscribeSecret ?? process.env.CLAUSLY_UNSUBSCRIBE_SECRET;

  if (!from) throw new Error("Missing CLAUSLY_EMAIL_FROM.");
  if (!unsubscribeSecret) throw new Error("Missing CLAUSLY_UNSUBSCRIBE_SECRET.");

  const dueOn = (options.now ?? new Date()).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("reminders")
    .select("id,user_id,document_id,title,description,fire_on,sent_at,documents(title),users(email,notification_preferences)")
    .eq("status", "approved")
    .eq("channel", "email")
    .is("sent_at", null)
    .lte("fire_on", dueOn)
    .order("fire_on", { ascending: true })
    .limit(100);

  if (error) throw new Error(error.message);

  const result: DispatchResult = { processed: 0, sent: 0, skipped: 0, failed: 0 };

  for (const reminder of ((data ?? []) as DispatchReminderRow[])) {
    result.processed += 1;

    const user = firstObject(reminder.users);
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
      result.sent += 1;
    } catch (error) {
      result.failed += 1;
      await logEmailFailure(supabase, reminder, error);
    }
  }

  return result;
}

export async function unsubscribeUserEmail(options: {
  supabase?: SupabaseClient;
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

async function logEmailFailure(supabase: SupabaseClient, reminder: DispatchReminderRow, error: unknown) {
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
