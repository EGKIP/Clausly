import { NextResponse } from "next/server";
import { z } from "zod";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { auditRequestMetadata, recordAuditEvent } from "@/lib/audit/log";
import { canUploadDocument } from "@/lib/billing/plan";
import { createClient } from "@/lib/supabase/server";
import { notificationPreferencesSchema, validationIssues } from "@/lib/validation/schemas";
import type { PlanName } from "@/lib/billing/limits";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  notification_preferences: notificationPreferencesSchema.partial().optional(),
}).strict();

type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
type NotificationPreferencesPatch = z.infer<typeof profileSchema>["notification_preferences"];

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({
      displayName: "Demo User",
      email: "demo@clausly.app",
      notificationPreferences: normalizeNotificationPreferences(null),
      plan: "free",
      usage: { documents: { current: 0, limit: 5 } },
      mockMode: true,
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("users")
    .select("full_name,email,notification_preferences")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const usage = await resolveProfileUsage(supabase, user.id);

  return NextResponse.json({
    displayName: data.full_name ?? user.email?.split("@")[0] ?? "Clausly user",
    email: data.email,
    notificationPreferences: normalizeNotificationPreferences(data.notification_preferences),
    plan: usage.plan,
    usage: { documents: { current: usage.current, limit: serializeLimit(usage.limit) } },
    mockMode: false,
  });
}

export async function PATCH(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const parsed = profileSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid profile update.",
        issues: validationIssues(parsed.error),
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: currentProfile, error: currentError } = await supabase
    .from("users")
    .select("full_name,email,notification_preferences")
    .eq("id", user.id)
    .single();

  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });

  const update: {
    full_name?: string;
    notification_preferences?: NotificationPreferences;
  } = {};

  if (parsed.data.displayName !== undefined) {
    update.full_name = parsed.data.displayName;
  }

  if (parsed.data.notification_preferences !== undefined) {
    update.notification_preferences = mergeNotificationPreferences(
      currentProfile.notification_preferences,
      parsed.data.notification_preferences
    );
  }

  const { data, error } = await supabase
    .from("users")
    .update(update)
    .eq("id", user.id)
    .select("full_name,email,notification_preferences")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const usage = await resolveProfileUsage(supabase, user.id);

  return NextResponse.json({
    displayName: data.full_name ?? currentProfile.full_name ?? user.email?.split("@")[0] ?? "Clausly user",
    email: data.email,
    notificationPreferences: normalizeNotificationPreferences(data.notification_preferences),
    plan: usage.plan,
    usage: { documents: { current: usage.current, limit: serializeLimit(usage.limit) } },
    mockMode: false,
  });
}

export async function DELETE(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("user_id", user.id);

  if (documentsError) {
    return NextResponse.json({ error: documentsError.message }, { status: 500 });
  }

  const storagePaths = (documents ?? [])
    .map((document) => document.storage_path)
    .filter((path) => path.startsWith(`${user.id}/`));

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove(storagePaths);

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }
  }

  try {
    await recordAuditEvent(supabase, {
      userId: user.id,
      action: AUDIT_ACTIONS.ACCOUNT_DELETED,
      resourceType: "account",
      resourceId: user.id,
      metadata: {
        documentCount: documents?.length ?? 0,
        storageObjectCount: storagePaths.length,
        ...auditRequestMetadata(request),
      },
    });
  } catch {
    // Audit logging is best-effort; account deletion remains the source of truth.
  }

  const { error: deletionError } = await supabase.rpc("delete_account", {
    target_user_id: user.id,
  });

  if (deletionError) {
    return NextResponse.json({ error: deletionError.message }, { status: 500 });
  }

  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    console.warn("Account deleted, but Supabase sign-out did not complete.", {
      userId: user.id,
      message: signOutError.message,
    });
  }

  return NextResponse.json({ ok: true });
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

async function resolveProfileUsage(supabase: Parameters<typeof canUploadDocument>[0], userId: string): Promise<{
  plan: PlanName;
  current: number;
  limit: number;
}> {
  const upload = await canUploadDocument(supabase, userId);
  return {
    plan: upload.plan,
    current: upload.current,
    limit: upload.limit,
  };
}

function serializeLimit(limit: number) {
  return Number.isFinite(limit) ? limit : null;
}

function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  const parsed = notificationPreferencesSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return notificationPreferencesSchema.parse({});
}

function mergeNotificationPreferences(
  storedValue: unknown,
  patch: NotificationPreferencesPatch
): NotificationPreferences {
  const current = normalizeNotificationPreferences(storedValue);
  const sanitizedPatch = { ...(patch ?? {}) };
  delete sanitizedPatch.version;
  const merged = notificationPreferencesSchema.parse({
    ...current,
    ...sanitizedPatch,
    defaults: sanitizedPatch.defaults
      ? { ...current.defaults, ...sanitizedPatch.defaults }
      : current.defaults,
  });

  if (sanitizedPatch.email !== undefined && sanitizedPatch.email !== current.email) {
    merged.version = current.version === undefined ? 1 : current.version + 1;
  }

  return merged;
}
