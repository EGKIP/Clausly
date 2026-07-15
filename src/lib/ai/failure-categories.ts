export type AnalysisFailureCategory =
  | "unsupported_file"
  | "storage_error"
  | "extraction_timeout"
  | "no_text"
  | "provider_error"
  | "stuck_timeout"
  | "unknown";

export const FAILURE_CATEGORY_COPY: Record<AnalysisFailureCategory, { title: string; message: string }> = {
  unsupported_file: {
    title: "This file couldn't be read",
    message: "The uploaded file doesn't look like a valid PDF. Try re-exporting or re-scanning it and upload again.",
  },
  storage_error: {
    title: "We couldn't retrieve the file",
    message: "Something went wrong reading the uploaded file from storage. Try re-analyzing — if it keeps failing, re-upload the document.",
  },
  extraction_timeout: {
    title: "This document took too long to read",
    message: "The PDF is unusually large or complex and timed out during text extraction. Try a smaller or simplified version of the file.",
  },
  no_text: {
    title: "No readable text found",
    message: "This looks like an image-only scan without a text layer, and OCR isn't available for it. Try a text-based PDF or enable OCR.",
  },
  provider_error: {
    title: "Analysis failed",
    message: "The AI analysis step ran into an error. This is usually temporary — try re-analyzing in a moment.",
  },
  stuck_timeout: {
    title: "Analysis didn't finish in time",
    message: "This document was still processing after several attempts and was stopped. Try re-analyzing, or use a smaller file if this keeps happening.",
  },
  unknown: {
    title: "We couldn't read this contract",
    message: "An unexpected error stopped the analysis. The original file is safe and still in your library.",
  },
};

/**
 * Buckets a thrown analysis error into a coarse, user-facing category.
 * Only covers categories that have to be inferred from a caught error's
 * message — "unsupported_file" (rejected during upload validation, before
 * analysis runs), "provider_error", and "stuck_timeout" are known from
 * context at their respective call sites and set directly, not sniffed here.
 */
export function categorizeAnalysisError(error: unknown): AnalysisFailureCategory {
  const message = error instanceof Error ? error.message : String(error);

  if (/timed out/i.test(message)) return "extraction_timeout";
  if (/returned no text|no text|OCR fallback returned no text/i.test(message)) return "no_text";
  if (/download|storage/i.test(message)) return "storage_error";

  return "unknown";
}
