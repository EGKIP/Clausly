import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getClausesFor } from "@/lib/mock-clauses";
import { documents as mockDocuments } from "@/lib/mock-data";
import { reminders as mockReminders } from "@/lib/mock-reminders";
import { toApiDate, toUiClause, toUiDocument, toUiReminder } from "./adapters";
import type { DocumentDetail, ReminderRow } from "./types";
import type { AnalysisFailureCategory } from "@/lib/ai/failure-categories";

// RLS already scopes `documents` to `auth.uid() = user_id`; the explicit
// `.eq("user_id", ...)` below is defense-in-depth against a future RLS
// regression, not the only guard.
export async function listDocuments() {
  if (!hasSupabaseEnv()) return mockDocuments;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let query = supabase.from("documents").select("*").order("created_at", { ascending: false });
  if (user) query = query.eq("user_id", user.id);
  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []).map(toUiDocument);
}

// `userId` is optional only because a couple of call sites predate this
// parameter; every caller that already has an authenticated user should pass
// it. RLS already scopes these tables to `auth.uid()`, so this is
// defense-in-depth against a future RLS regression, not the only guard.
export async function getDocumentDetail(id: string, userId?: string): Promise<DocumentDetail | null> {
  if (!hasSupabaseEnv()) {
    const document = mockDocuments.find((item) => item.id === id);
    if (!document) return null;
    return {
      document,
      status: "ready",
      errorMessage: null,
      failureCategory: null,
      clauses: getClausesFor(id),
      dates: [],
      reminders: mockReminders.filter((item) => item.docId === id),
      signedUrl: null,
    };
  }

  const supabase = await createClient();
  let documentQuery = supabase.from("documents").select("*").eq("id", id);
  if (userId) documentQuery = documentQuery.eq("user_id", userId);
  const { data: document, error: documentError } = await documentQuery.single();

  if (documentError) {
    if (documentError.code === "PGRST116") return null;
    throw documentError;
  }

  let clausesQuery = supabase.from("clauses").select("*").eq("document_id", id);
  let datesQuery = supabase.from("dates").select("*").eq("document_id", id);
  let remindersQuery = supabase
    .from("reminders")
    .select("*, documents(title)")
    .eq("document_id", id)
    // Ignored reminders must stay hidden here too: toUiReminder maps
    // 'ignored' back to 'suggested' for the UI type, so leaking them
    // makes the detail page disagree with the reminders inbox.
    .neq("status", "ignored");
  if (userId) {
    clausesQuery = clausesQuery.eq("user_id", userId);
    datesQuery = datesQuery.eq("user_id", userId);
    remindersQuery = remindersQuery.eq("user_id", userId);
  }

  const [{ data: clauses, error: clausesError }, { data: dates, error: datesError }, { data: reminders, error: remindersError }] =
    await Promise.all([
      clausesQuery.order("page_number", { ascending: true }),
      datesQuery.order("date_value", { ascending: true }),
      remindersQuery.order("fire_on", { ascending: true }),
    ]);

  if (clausesError) throw clausesError;
  if (datesError) throw datesError;
  if (remindersError) throw remindersError;

  /* Demo / seeded documents land with an empty storage_path because they
   * have no PDF on disk. Skip the signed-URL roundtrip and let the preview
   * fall back to the FauxPaper rendering. */
  // 60 minutes: long enough to cover a normal read-through-the-contract
  // session (react-pdf streams pages on demand against this URL well after
  // the initial load), while still bounding how long a leaked URL works.
  const signedUrl = document.storage_path
    ? (
        await supabase.storage
          .from("documents")
          .createSignedUrl(document.storage_path, 60 * 60)
      ).data?.signedUrl ?? null
    : null;

  return {
    document: toUiDocument(document),
    status: document.status,
    errorMessage: document.error_message,
    failureCategory: document.failure_category as AnalysisFailureCategory | null,
    clauses: (clauses ?? []).map(toUiClause),
    dates: (dates ?? []).map(toApiDate),
    reminders: ((reminders ?? []) as ReminderRow[]).map(toUiReminder),
    signedUrl,
  };
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
