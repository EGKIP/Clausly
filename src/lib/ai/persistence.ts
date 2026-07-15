import type { SupabaseClient } from "@supabase/supabase-js";
import { uiRiskToApi } from "@/lib/db/types";
import type { Database } from "@/lib/supabase/types";
import type { AnalysisResult } from "./schema";

type AnyClient = SupabaseClient<Database>;

export type PersistResult = {
  documentId: string;
  clauseIds: string[];
  dateIds: string[];
  reminderIds: string[];
};

/**
 * Persist a validated analysis result for an owned document. Updates the
 * documents row, inserts clauses/dates/reminders, and rolls back to
 * status='failed' if any insert fails so the caller gets a clean retry path.
 * Replaces any existing clauses, dates, and reminders for this
 * (documentId, userId) pair before inserting the new snapshot.
 *
 * Callers must verify documentId ownership before calling. RLS provides a
 * second line of defense, but this helper trusts the caller's user_id.
 *
 * attemptToken fences the final documents write: it's a no-op if a newer
 * attempt has since claimed the document (documents.analysis_attempts no
 * longer matches), so a stale/superseded attempt can't clobber a newer
 * attempt's document-level status/summary/risk fields. This does NOT extend
 * to the clause/date/reminder delete+insert steps below — a genuinely
 * concurrent stale write can still replace those with stale data. The
 * atomic claim in run-analysis.ts's claimAnalysisAttempt() prevents two
 * attempts from running concurrently in the common case; this token guards
 * the residual case of an attempt that's already past the claim step (e.g.
 * on a zombie/frozen instance) resuming after a newer attempt has taken
 * over. See the durable analysis pipeline plan for the accepted tradeoff.
 */
export async function persistAnalysis(
  supabase: AnyClient,
  documentId: string,
  userId: string,
  result: AnalysisResult,
  attemptToken: number,
): Promise<PersistResult> {
  // Snapshot semantics: a successful persist replaces the prior analysis. On a
  // first analyze these deletes hit zero rows; on reanalyze they clear stale
  // extracted data so the new snapshot is clean. RLS + the explicit user_id
  // filter keep this scoped to the owner.
  const { error: clauseClearError } = await supabase
    .from("clauses").delete().eq("document_id", documentId).eq("user_id", userId);
  if (clauseClearError) throw new AnalysisPersistenceError("clauses.clear", clauseClearError.message);

  const { error: dateClearError } = await supabase
    .from("dates").delete().eq("document_id", documentId).eq("user_id", userId);
  if (dateClearError) throw new AnalysisPersistenceError("dates.clear", dateClearError.message);

  const { error: reminderClearError } = await supabase
    .from("reminders").delete().eq("document_id", documentId).eq("user_id", userId);
  if (reminderClearError) throw new AnalysisPersistenceError("reminders.clear", reminderClearError.message);

  const documentUpdate = {
    title: result.documentTitle,
    document_type: result.documentType,
    jurisdiction: result.jurisdiction,
    page_count: result.pageCount ?? 0,
    risk_level: uiRiskToApi[result.riskLevel],
    monthly_value: result.monthlyValue,
    effective_date: result.effectiveDate,
    end_date: result.endDate,
    notice_window_days: result.noticeWindowDays,
    summary_short: result.summaryShort,
    summary: result.summaryLong || result.summaryShort,
    tags: result.tags,
    status: "ready" as const,
    error_message: null,
    failure_category: null,
  };

  const { error: updateError } = await supabase
    .from("documents")
    .update(documentUpdate)
    .eq("id", documentId)
    .eq("user_id", userId)
    .eq("analysis_attempts", attemptToken);
  if (updateError) throw new AnalysisPersistenceError("documents.update", updateError.message);

  const clauseRows = result.clauses.map((clause) => ({
    user_id: userId,
    document_id: documentId,
    title: clause.title,
    category: clause.category,
    risk_level: uiRiskToApi[clause.riskLevel],
    page_number: clause.sourcePage,
    source_quote: clause.sourceText,
    plain_english: clause.plainEnglish,
    why_it_matters: clause.whyItMatters || null,
    confidence: clause.confidence,
  }));

  let clauseIds: string[] = [];
  if (clauseRows.length > 0) {
    const { data, error } = await supabase.from("clauses").insert(clauseRows).select("id");
    if (error) return rollback(supabase, documentId, userId, attemptToken, "clauses.insert", error.message);
    clauseIds = (data ?? []).map((row: { id: string }) => row.id);
  }

  const dateRows = result.importantDates.map((entry) => ({
    user_id: userId,
    document_id: documentId,
    label: entry.title,
    date_value: entry.date,
    kind: entry.kind,
    description: entry.description || null,
    source_quote: entry.sourceText || null,
    confidence: entry.confidence,
  }));

  let dateIds: string[] = [];
  if (dateRows.length > 0) {
    const { data, error } = await supabase.from("dates").insert(dateRows).select("id");
    if (error) return rollback(supabase, documentId, userId, attemptToken, "dates.insert", error.message);
    dateIds = (data ?? []).map((row: { id: string }) => row.id);
  }

  const reminderRows = result.suggestedReminders.map((reminder) => ({
    user_id: userId,
    document_id: documentId,
    title: reminder.title,
    description: reminder.description || reminder.title,
    fire_on: reminder.date,
    reminder_type: reminder.type,
    source_quote: reminder.sourceText || null,
    confidence: reminder.confidence,
    status: "suggested" as const,
    channel: "email" as const,
  }));

  let reminderIds: string[] = [];
  if (reminderRows.length > 0) {
    const { data, error } = await supabase.from("reminders").insert(reminderRows).select("id");
    if (error) return rollback(supabase, documentId, userId, attemptToken, "reminders.insert", error.message);
    reminderIds = (data ?? []).map((row: { id: string }) => row.id);
  }

  return { documentId, clauseIds, dateIds, reminderIds };
}

export class AnalysisPersistenceError extends Error {
  constructor(public readonly step: string, message: string) {
    super(`${step}: ${message}`);
    this.name = "AnalysisPersistenceError";
  }
}

async function rollback(
  supabase: AnyClient,
  documentId: string,
  userId: string,
  attemptToken: number,
  step: string,
  message: string,
): Promise<never> {
  await supabase.from("clauses").delete().eq("document_id", documentId).eq("user_id", userId);
  await supabase.from("dates").delete().eq("document_id", documentId).eq("user_id", userId);
  await supabase.from("reminders").delete().eq("document_id", documentId).eq("user_id", userId);
  await supabase
    .from("documents")
    .update({ status: "failed", error_message: `${step}: ${message}`, failure_category: "provider_error" as const })
    .eq("id", documentId)
    .eq("user_id", userId)
    .eq("analysis_attempts", attemptToken);
  throw new AnalysisPersistenceError(step, message);
}
