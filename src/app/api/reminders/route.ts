import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toUiReminder } from "@/lib/db/adapters";
import type { ReminderRow } from "@/lib/db/types";
import { reminders as mockReminders } from "@/lib/mock-reminders";
import { reminderCreateSchema, validationIssues } from "@/lib/validation";
import { reminderListQuerySchema, toDbStatus, validationIssues as reminderValidationIssues } from "@/lib/reminders/validation";

export async function GET(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ reminders: mockReminders });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const parsed = reminderListQuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    document_id: url.searchParams.get("document_id") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reminder filters.", issues: reminderValidationIssues(parsed.error) },
      { status: 400 }
    );
  }

  let query = supabase
    .from("reminders")
    .select("*, documents(title)")
    .eq("user_id", user.id);

  if (parsed.data.status) query = query.eq("status", toDbStatus(parsed.data.status));
  else query = query.neq("status", "ignored");
  if (parsed.data.document_id) query = query.eq("document_id", parsed.data.document_id);

  const { data, error } = await query.order("fire_on", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminders: ((data ?? []) as ReminderRow[]).map(toUiReminder) });
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawBody = await request.json();
  const parsed = reminderCreateSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reminder.", issues: validationIssues(parsed.error) },
      { status: 400 }
    );
  }

  const body = parsed.data;
  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id")
    .eq("id", body.documentId)
    .single();

  if (documentError || !document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("reminders")
    .insert({
      user_id: user.id,
      document_id: body.documentId,
      date_id: body.dateId ?? null,
      title: body.title,
      description: body.description,
      fire_on: body.fireOn,
      reminder_type: body.type,
      status: "suggested",
      channel: "email",
    })
    .select("*, documents(title)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminder: toUiReminder(data as ReminderRow) }, { status: 201 });
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
