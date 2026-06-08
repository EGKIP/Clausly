import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getClausesFor } from "@/lib/mock-clauses";
import { documents as mockDocuments } from "@/lib/mock-data";
import { reminders as mockReminders } from "@/lib/mock-reminders";
import { toApiDate, toUiClause, toUiDocument, toUiReminder } from "./adapters";
import type { DocumentDetail, DocumentRow, ReminderRow } from "./types";

export async function listDocuments() {
  if (!hasSupabaseEnv()) return mockDocuments;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toUiDocument);
}

export async function listDocumentRows() {
  if (!hasSupabaseEnv()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as DocumentRow[];
}

export async function getDocumentDetail(id: string): Promise<DocumentDetail | null> {
  if (!hasSupabaseEnv()) {
    const document = mockDocuments.find((item) => item.id === id);
    if (!document) return null;
    return {
      document,
      status: "ready",
      errorMessage: null,
      clauses: getClausesFor(id),
      dates: [],
      reminders: mockReminders.filter((item) => item.docId === id),
      signedUrl: null,
    };
  }

  const supabase = await createClient();
  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (documentError) {
    if (documentError.code === "PGRST116") return null;
    throw documentError;
  }

  const [{ data: clauses, error: clausesError }, { data: dates, error: datesError }, { data: reminders, error: remindersError }] =
    await Promise.all([
      supabase.from("clauses").select("*").eq("document_id", id).order("page_number", { ascending: true }),
      supabase.from("dates").select("*").eq("document_id", id).order("date_value", { ascending: true }),
      supabase
        .from("reminders")
        .select("*, documents(title)")
        .eq("document_id", id)
        .order("fire_on", { ascending: true }),
    ]);

  if (clausesError) throw clausesError;
  if (datesError) throw datesError;
  if (remindersError) throw remindersError;

  /* Demo / seeded documents land with an empty storage_path because they
   * have no PDF on disk. Skip the signed-URL roundtrip and let the preview
   * fall back to the FauxPaper rendering. */
  const signedUrl = document.storage_path
    ? (
        await supabase.storage
          .from("documents")
          .createSignedUrl(document.storage_path, 60 * 10)
      ).data?.signedUrl ?? null
    : null;

  return {
    document: toUiDocument(document),
    status: document.status,
    errorMessage: document.error_message,
    clauses: (clauses ?? []).map(toUiClause),
    dates: (dates ?? []).map(toApiDate),
    reminders: ((reminders ?? []) as ReminderRow[]).map(toUiReminder),
    signedUrl,
  };
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
