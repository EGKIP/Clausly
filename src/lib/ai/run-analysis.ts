import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { analyzeDocument, getAnalysisModel, getAnalysisProvider } from "./provider";
import { persistAnalysis } from "./persistence";
import * as pdfText from "./pdf-text";
import { recordUsage } from "./usage-metrics";

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
};

export async function getAnalysisDocument(
  supabase: AnyClient,
  documentId: string,
  userId: string,
): Promise<{ document: AnalysisDocument | null; error: { message: string; code?: string } | null }> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, user_id, title, file_name, storage_path, jurisdiction, status")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  return {
    document: data as AnalysisDocument | null,
    error,
  };
}

export async function runAnalysis(
  supabase: AnyClient,
  documentId: string,
  userId: string,
  document?: AnalysisDocument,
) {
  const doc = document ?? (await loadOwnedDocument(supabase, documentId, userId));

  const { error: statusError } = await supabase
    .from("documents")
    .update({ status: "analyzing", error_message: null })
    .eq("id", doc.id)
    .eq("user_id", userId);
  if (statusError) throw statusError;

  let text: string;
  try {
    const { data: file, error: downloadError } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);

    if (downloadError) throw new Error(downloadError.message);
    if (!file) throw new Error("Document file could not be downloaded.");

    text = await getPdfTextExtractor()(file);
  } catch (error) {
    await markAnalysisFailed(supabase, doc.id, userId, errorMessage(error));
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
    await markAnalysisFailed(supabase, doc.id, userId, errorMessage(error));
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

  return persistAnalysis(supabase, doc.id, userId, result);
}

export async function markAnalysisFailed(
  supabase: AnyClient,
  documentId: string,
  userId: string,
  message: string,
) {
  await supabase
    .from("documents")
    .update({ status: "failed", error_message: truncateError(message) })
    .eq("id", documentId)
    .eq("user_id", userId);
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
