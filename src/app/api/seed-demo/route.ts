import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDemoDocuments } from "@/lib/db/seed-demo";

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

  const seeded = [];
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
    if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 });

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
    if (clauseError) return NextResponse.json({ error: clauseError.message }, { status: 500 });

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
    if (dateError) return NextResponse.json({ error: dateError.message }, { status: 500 });

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
    if (reminderError) return NextResponse.json({ error: reminderError.message }, { status: 500 });

    seeded.push(documentId);
  }

  return NextResponse.json({ seeded: seeded.length, documentIds: seeded });
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
