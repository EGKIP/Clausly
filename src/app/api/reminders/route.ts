import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toUiReminder } from "@/lib/db/adapters";
import type { ReminderRow } from "@/lib/db/types";
import { reminders as mockReminders } from "@/lib/mock-reminders";

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ reminders: mockReminders });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("reminders")
    .select("*, documents(title)")
    .neq("status", "ignored")
    .order("fire_on", { ascending: true });

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

  const body = await request.json() as {
    documentId?: string;
    dateId?: string | null;
    title?: string;
    description?: string;
    fireOn?: string;
    type?: string;
  };

  if (!body.documentId || !body.title || !body.description || !body.fireOn) {
    return NextResponse.json({ error: "Missing reminder fields." }, { status: 400 });
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
      reminder_type: body.type ?? "Review",
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
