import { NextResponse } from "next/server";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { auditRequestMetadata, recordAuditEvent } from "@/lib/audit/log";
import { createClient } from "@/lib/supabase/server";
import { toUiReminder } from "@/lib/db/adapters";
import type { ReminderRow } from "@/lib/db/types";
import { reminderApproveSchema, validationIssues } from "@/lib/reminders/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = reminderApproveSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reminder approval.", issues: validationIssues(parsed.error) },
      { status: 400 }
    );
  }

  const { id } = await context.params;
  const { data: existing, error: existingError } = await supabase
    .from("reminders")
    .select("*, documents(title)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (existingError) {
    if (existingError.code === "PGRST116") {
      return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
    }
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing.status === "sent") {
    return NextResponse.json({ error: "Sent reminders cannot be approved." }, { status: 409 });
  }

  if (existing.status !== "suggested" && existing.status !== "approved") {
    return NextResponse.json({ error: "Dismissed reminders cannot be approved." }, { status: 409 });
  }

  // Approving a reminder whose fire date already passed would queue an email
  // that can never fire on time. Applies to the date after any override in
  // this request, so editing the date to a future one in the same call works.
  const effectiveFireOn = parsed.data.fire_on ?? String(existing.fire_on).slice(0, 10);
  if (effectiveFireOn < todayUtcDate()) {
    return NextResponse.json(
      {
        error: "This reminder's date has already passed. Edit it to a future date before approving.",
        code: "REMINDER_PAST",
      },
      { status: 409 }
    );
  }

  const wasSuggested = existing.status === "suggested";
  const { data, error } = await supabase
    .from("reminders")
    .update({
      ...parsed.data,
      status: "approved",
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*, documents(title)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (wasSuggested) {
    await logReminderLifecycle(supabase, user.id, existing.document_id);
    try {
      await recordAuditEvent(supabase, {
        userId: user.id,
        action: AUDIT_ACTIONS.REMINDER_APPROVED,
        resourceType: "reminder",
        resourceId: id,
        metadata: {
          documentId: existing.document_id,
          ...auditRequestMetadata(request),
        },
      });
    } catch {
      // Audit logging is best-effort; reminder approval remains the source of truth.
    }
  }

  return NextResponse.json({ reminder: toUiReminder(data as ReminderRow) });
}

async function logReminderLifecycle(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, documentId: string | null) {
  try {
    await supabase.from("usage_metrics").insert({
      user_id: userId,
      document_id: documentId,
      job_type: "reminder_lifecycle",
      input_token_count: 0,
      output_token_count: 0,
      status: "completed",
    });
  } catch {
    // usage_metrics is best-effort here; reminder state is the source of truth.
  }
}

function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
