import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { analyzeDocument, getAnalysisModel, getAnalysisProvider } from "./provider";
import { persistAnalysis } from "./persistence";
import * as pdfText from "./pdf-text";
import { recordUsage } from "./usage-metrics";
import { embedDocumentChunks } from "./embeddings";
import { categorizeAnalysisError, type AnalysisFailureCategory } from "./failure-categories";

type AnyClient = SupabaseClient<Database>;
type PdfTextExtractor = typeof pdfText.extractPdfText;
type PdfTextModule = {
  extractPdfText: PdfTextExtractor;
  extractPdfTextWithOcr?: PdfTextExtractor;
};

type AnalysisDocument = {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  storage_path: string;
  jurisdiction: string | null;
  status: Database["public"]["Enums"]["document_status"];
  analysis_attempts: number;
};

const ANALYSIS_DOCUMENT_COLUMNS =
  "id, user_id, title, file_name, storage_path, jurisdiction, status, analysis_attempts";

export class AlreadyAnalyzingError extends Error {
  constructor() {
    super("This document is already being analyzed.");
    this.name = "AlreadyAnalyzingError";
  }
}

export type ClaimResult =
  | { claimed: true; attemptToken: number; document: AnalysisDocument }
  | { claimed: false };

export async function getAnalysisDocument(
  supabase: AnyClient,
  documentId: string,
  userId: string,
): Promise<{ document: AnalysisDocument | null; error: { message: string; code?: string } | null }> {
  const { data, error } = await supabase
    .from("documents")
    .select(ANALYSIS_DOCUMENT_COLUMNS)
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  return {
    document: data as AnalysisDocument | null,
    error,
  };
}

/**
 * Atomically claims a document for analysis: bumps analysis_attempts (which
 * also serves as this attempt's fencing token — see persistAnalysis's doc
 * comment) and flips status to 'analyzing' in a single conditional UPDATE, so
 * two concurrent callers can't both start analyzing the same document.
 *
 * Without `requireStaleSince`, the claim predicate is "not currently
 * analyzing" (the normal upload/analyze/reanalyze path). With it, the
 * predicate instead requires the document to already be 'analyzing' with an
 * analysis_started_at older than the given cutoff — used by the
 * stuck-analysis recovery sweep to reclaim a document whose prior attempt
 * never finished, without racing a legitimately in-progress one.
 *
 * Returns `{claimed: false}` (not an error) when the predicate doesn't
 * match — that's the expected outcome when something else currently holds
 * the claim.
 */
export async function claimAnalysisAttempt(
  supabase: AnyClient,
  documentId: string,
  userId: string,
  options?: { requireStaleSince?: string },
): Promise<ClaimResult> {
  const { document: current, error } = await getAnalysisDocument(supabase, documentId, userId);
  if (error || !current) {
    throw new Error(error?.message ?? "Document not found.");
  }

  const attemptToken = (current.analysis_attempts ?? 0) + 1;

  let query = supabase
    .from("documents")
    .update({
      status: "analyzing" as const,
      analysis_started_at: new Date().toISOString(),
      analysis_attempts: attemptToken,
      error_message: null,
      failure_category: null,
    })
    .eq("id", documentId)
    .eq("user_id", userId);

  query = options?.requireStaleSince
    ? query.eq("status", "analyzing").lt("analysis_started_at", options.requireStaleSince)
    : query.neq("status", "analyzing");

  const { data, error: claimError } = await query.select(ANALYSIS_DOCUMENT_COLUMNS).maybeSingle();
  if (claimError) throw claimError;
  if (!data) return { claimed: false };

  return { claimed: true, attemptToken, document: data as AnalysisDocument };
}

export async function runAnalysis(
  supabase: AnyClient,
  documentId: string,
  userId: string,
  document?: AnalysisDocument,
) {
  const doc = document ?? (await loadOwnedDocument(supabase, documentId, userId));
  const claim = await claimAnalysisAttempt(supabase, doc.id, userId);
  if (!claim.claimed) throw new AlreadyAnalyzingError();

  return runClaimedAnalysis(supabase, userId, claim.document, claim.attemptToken);
}

/** Runs the analysis pipeline body for a document already claimed via claimAnalysisAttempt(). */
export async function runClaimedAnalysis(
  supabase: AnyClient,
  userId: string,
  doc: AnalysisDocument,
  attemptToken: number,
) {
  let text: string;
  try {
    const { data: file, error: downloadError } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);

    if (downloadError) throw new Error(downloadError.message);
    if (!file) throw new Error("Document file could not be downloaded.");

    text = await getPdfTextExtractor()(file);
  } catch (error) {
    await markAnalysisFailed(supabase, doc.id, userId, errorMessage(error), categorizeAnalysisError(error), attemptToken);
    throw error;
  }

  let result;
  const provider = getAnalysisProvider();
  const model = getAnalysisModel(provider);
  let analysisError: unknown = null;
  try {
    result = await analyzeDocument({
      text,
      fileName: doc.file_name,
      title: doc.title,
      jurisdictionHint: doc.jurisdiction,
    });
  } catch (error) {
    analysisError = error;
    await markAnalysisFailed(supabase, doc.id, userId, errorMessage(error), "provider_error", attemptToken);
    throw error;
  } finally {
    await recordUsage(supabase, {
      userId,
      documentId: doc.id,
      provider,
      model,
      status: analysisError ? "failed" : "completed",
      errorMessage: analysisError ? errorMessage(analysisError) : null,
    });
  }

  // A title the user chose (at upload or via rename) must survive
  // re-analysis. Only let the provider's title through when the current one
  // is still the filename-derived default from the upload route.
  if (!isFilenameDerivedTitle(doc.title, doc.file_name)) {
    result = { ...result, documentTitle: doc.title };
  }

  // Index chunks before the document flips to 'ready' so Ask Clausly never
  // sees a ready document with an empty index. Indexing failure stays
  // non-fatal to the analysis itself — the Ask route can rebuild the index
  // on demand — but it must not go unnoticed (embedDocumentChunks logs at
  // error level and reports the failure back).
  const embedResult = await embedDocumentChunks(supabase, doc.id, userId, text);
  if (embedResult.error) {
    console.error("Analysis completed but chunk indexing failed; Ask Clausly will attempt on-demand recovery.", {
      documentId: doc.id,
      message: embedResult.error,
    });
  }

  return persistAnalysis(supabase, doc.id, userId, result, attemptToken);
}

export async function markAnalysisFailed(
  supabase: AnyClient,
  documentId: string,
  userId: string,
  message: string,
  category: AnalysisFailureCategory,
  attemptToken: number,
) {
  // The status='analyzing' check (on top of the attemptToken fence) matters
  // most for callers reporting failure well after the attempt started, e.g.
  // the stuck-analysis recovery sweep: it stops a stale "give up" write from
  // clobbering a document that a still-valid attempt already completed
  // successfully (persistAnalysis doesn't change analysis_attempts, so
  // status is the thing that would've moved).
  await supabase
    .from("documents")
    .update({ status: "failed", error_message: truncateError(message), failure_category: category })
    .eq("id", documentId)
    .eq("user_id", userId)
    .eq("analysis_attempts", attemptToken)
    .eq("status", "analyzing");
}

function isFilenameDerivedTitle(title: string, fileName: string) {
  const trimmed = title.trim();
  return trimmed === fileName.trim() || trimmed === fileName.replace(/\.pdf$/i, "").trim();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Document analysis failed.";
}

function truncateError(message: string) {
  return message.slice(0, 500);
}

async function loadOwnedDocument(supabase: AnyClient, documentId: string, userId: string) {
  const { document, error } = await getAnalysisDocument(supabase, documentId, userId);
  if (error || !document) {
    throw new Error(error?.message ?? "Document not found.");
  }
  return document;
}

function getPdfTextExtractor() {
  const pdfTextModule = pdfText as PdfTextModule;
  if ("extractPdfTextWithOcr" in pdfTextModule) {
    return pdfTextModule.extractPdfTextWithOcr ?? pdfTextModule.extractPdfText;
  }
  return pdfTextModule.extractPdfText;
}
