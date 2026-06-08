import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toUiReminder } from "@/lib/db/adapters";
import type { ReminderRow } from "@/lib/db/types";
import { reminderPatchLifecycleSchema, validationIssues } from "@/lib/reminders/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    return NextResponse.json({ error: "Sent reminders cannot be updated." }, { status: 409 });
  }

  if (existing.status !== "suggested" && existing.status !== "approved") {
    return NextResponse.json({ error: "Dismissed reminders cannot be updated." }, { status: 409 });
  }

  const parsed = reminderPatchLifecycleSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reminder update.", issues: validationIssues(parsed.error) },
      { status: 400 }
    );
  }

  const body = parsed.data;

  const { data, error } = await supabase
    .from("reminders")
    .update({
      title: body.title,
      description: body.description,
      fire_on: body.fire_on,
      reminder_time: body.reminder_time,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*, documents(title)")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reminder: toUiReminder(data as ReminderRow) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const { data: existing, error: existingError } = await supabase
    .from("reminders")
    .select("id, status, document_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (existingError) {
    if (existingError.code === "PGRST116") {
      return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
    }
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const { error } = await supabase
    .from("reminders")
    .update({ status: "ignored" })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (existing.status !== "ignored") {
    await logReminderLifecycle(supabase, user.id, existing.document_id);
  }

  return NextResponse.json({ ok: true });
}

export async function GET(_request: Request, context: RouteContext) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const { data, error } = await supabase
    .from("reminders")
    .select("*, documents(title)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
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

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
