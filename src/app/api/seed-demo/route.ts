import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getDemoDocuments } from "@/lib/db/seed-demo";
import type { Database } from "@/lib/supabase/types";

export async function POST() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ skipped: true });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count, error: countError } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true });

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "Portfolio not empty." }, { status: 409 });
  }

  /* Inserts are not wrapped in a single SQL transaction (supabase-js has no
   * client-side transactions). Instead, track every document we create so we
   * can cascade-delete them if any later step fails — leaving the portfolio
   * in its original empty state so the user can retry cleanly. */
  const seeded: string[] = [];
  const fail = async (message: string, status = 500) => {
    await rollback(supabase, seeded);
    return NextResponse.json({ error: message }, { status });
  };

  for (const demo of getDemoDocuments()) {
    const documentId = crypto.randomUUID();
    const { error: documentError } = await supabase.from("documents").insert({
      id: documentId,
      user_id: user.id,
      title: demo.title,
      party: demo.party,
      document_type: demo.type,
      jurisdiction: demo.jurisdiction,
      page_count: demo.pageCount,
      storage_path: "",
      file_name: "demo.pdf",
      mime_type: "application/pdf",
      file_size_bytes: 0,
      status: "ready",
      risk_level: demo.riskLevel,
      monthly_value: demo.monthlyValue,
      effective_date: demo.effectiveDate,
      end_date: demo.endDate,
      notice_window_days: demo.noticeWindowDays,
      summary: demo.summary,
      summary_short: demo.summary,
      tags: demo.tags,
    });
    if (documentError) return fail(documentError.message);
    seeded.push(documentId);

    const clauseRows = demo.clauses.map((clause) => ({
      id: crypto.randomUUID(),
      user_id: user.id,
      document_id: documentId,
      title: clause.title,
      category: clause.category,
      risk_level: clause.riskLevel,
      page_number: clause.page,
      source_quote: clause.sourceQuote,
      plain_english: clause.plainEnglish,
      why_it_matters: clause.whyItMatters,
      confidence: clause.confidence,
      bbox: clause.bbox,
    }));
    const { error: clauseError } = await supabase.from("clauses").insert(clauseRows);
    if (clauseError) return fail(clauseError.message);

    const dateRows = demo.dates.map((date) => ({
      id: crypto.randomUUID(),
      user_id: user.id,
      document_id: documentId,
      label: date.label,
      date_value: date.date,
      kind: date.kind,
      description: date.description,
      source_quote: date.sourceQuote,
      confidence: date.confidence,
    }));
    const { data: insertedDates, error: dateError } = await supabase
      .from("dates")
      .insert(dateRows)
      .select("id");
    if (dateError) return fail(dateError.message);

    const { error: reminderError } = await supabase.from("reminders").insert({
      user_id: user.id,
      document_id: documentId,
      date_id: insertedDates?.[0]?.id ?? null,
      title: demo.reminder.title,
      description: demo.reminder.description,
      fire_on: demo.reminder.fireOn,
      status: "suggested",
      channel: "email",
      reminder_type: demo.reminder.type,
      source_quote: demo.reminder.sourceQuote,
      confidence: demo.reminder.confidence,
    });
    if (reminderError) return fail(reminderError.message);
  }

  return NextResponse.json({ seeded: seeded.length, documentIds: seeded });
}

async function rollback(supabase: SupabaseClient<Database>, documentIds: string[]) {
  if (documentIds.length === 0) return;
  await supabase.from("documents").delete().in("id", documentIds);
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
