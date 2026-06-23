import { NextResponse } from "next/server";
import { canExport } from "@/lib/exports/limits";
import { clausesToCsv, datesToCsv } from "@/lib/exports/csv";
import { renderDocumentPdf } from "@/lib/exports/pdf";
import { buildExportZip } from "@/lib/exports/zip";
import { toApiDate, toUiClause, toUiDocument, toUiReminder } from "@/lib/db/adapters";
import type { ClauseRow, DateRow, DocumentRow, ReminderRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ExportFormat = "pdf" | "csv";

export async function GET(request: Request, context: RouteContext) {
  const url = new URL(request.url);
  const format = parseFormat(url.searchParams.get("format"));
  if (!format) {
    return NextResponse.json({ error: "Choose an export format: pdf or csv." }, { status: 400 });
  }

  const { id } = await context.params;
  if (!hasSupabaseEnv()) {
    return mockExportResponse(id, format);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (documentError) {
    if (documentError.code === "PGRST116") {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    return NextResponse.json({ error: documentError.message }, { status: 500 });
  }

  const gate = await canExport(supabase, user.id);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: `Free plan is limited to ${gate.limit} exports every 30 days.`,
        code: "EXPORT_RATE_LIMIT",
        used: gate.used,
        limit: gate.limit,
        plan: gate.plan,
        resetsAt: gate.resetsAt,
      },
      { status: 429 }
    );
  }

  const [{ data: clauses, error: clausesError }, { data: dates, error: datesError }, { data: reminders, error: remindersError }] =
    await Promise.all([
      supabase.from("clauses").select("*").eq("document_id", id).eq("user_id", user.id).order("page_number", { ascending: true }),
      supabase.from("dates").select("*").eq("document_id", id).eq("user_id", user.id).order("date_value", { ascending: true }),
      supabase
        .from("reminders")
        .select("*, documents(title)")
        .eq("document_id", id)
        .eq("user_id", user.id)
        .order("fire_on", { ascending: true }),
    ]);

  if (clausesError) return NextResponse.json({ error: clausesError.message }, { status: 500 });
  if (datesError) return NextResponse.json({ error: datesError.message }, { status: 500 });
  if (remindersError) return NextResponse.json({ error: remindersError.message }, { status: 500 });

  const uiDocument = toUiDocument(document as DocumentRow);
  const uiClauses = ((clauses ?? []) as ClauseRow[]).map(toUiClause);
  const apiDates = ((dates ?? []) as DateRow[]).map(toApiDate);
  const uiReminders = ((reminders ?? []) as ReminderRow[]).map(toUiReminder);
  const fileBase = slugify(uiDocument.title);

  const response = format === "pdf"
    ? new Response(bufferToArrayBuffer(await renderDocumentPdf({
        document: uiDocument,
        clauses: uiClauses,
        dates: apiDates,
        reminders: uiReminders,
      })), {
        headers: downloadHeaders("application/pdf", `${fileBase}.pdf`),
      })
    : new Response(bufferToArrayBuffer(await buildExportZip({
        clausesCsv: clausesToCsv(uiClauses),
        datesCsv: datesToCsv(apiDates),
      })), {
        headers: downloadHeaders("application/zip", `${fileBase}-export.zip`),
      });

  await recordExportAudit(supabase, { userId: user.id, documentId: id, format });
  return response;
}

async function recordExportAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: { userId: string; documentId: string; format: ExportFormat }
) {
  try {
    const { error } = await supabase.from("document_exports").insert({
      user_id: input.userId,
      document_id: input.documentId,
      format: input.format,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.warn("Document export audit insert failed.", {
      documentId: input.documentId,
      message: error instanceof Error ? error.message : "Unknown export audit error.",
    });
  }
}

function parseFormat(value: string | null): ExportFormat | null {
  return value === "pdf" || value === "csv" ? value : null;
}

function mockExportResponse(documentId: string, format: ExportFormat) {
  const fileBase = slugify(documentId || "demo-document");
  if (format === "pdf") {
    return new Response(Buffer.from("%PDF-1.4\n% Clausly demo export\n%%EOF\n"), {
      headers: downloadHeaders("application/pdf", `${fileBase}.pdf`),
    });
  }

  return new Response(Buffer.from("PK\u0005\u0006" + "\0".repeat(18), "binary"), {
    headers: downloadHeaders("application/zip", `${fileBase}-export.zip`),
  });
}

function downloadHeaders(contentType: string, filename: string) {
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"`,
  };
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "document";
}

function bufferToArrayBuffer(buffer: Buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
