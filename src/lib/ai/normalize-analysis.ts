/**
 * Best-effort normalization of raw model output before schema validation.
 * Repairs common, semantically-safe drift (wrapper objects, natural-language
 * enum variants) without loosening the final schema — anything this module
 * doesn't recognize passes through unchanged and still fails validation.
 * Pure functions; never logs payload content.
 */

const WRAPPER_KEYS = ["analysis", "result", "data", "contractAnalysis"] as const;

const ANALYSIS_SIGNATURE_KEYS = ["documentTitle", "documentType", "summaryShort"] as const;

export function normalizeAnalysisPayload(raw: unknown): unknown {
  const payload = unwrapAnalysisObject(raw);
  if (!isRecord(payload)) return payload;

  const next: Record<string, unknown> = { ...payload };

  if (typeof next.documentType === "string") {
    next.documentType = normalizeDocumentType(next.documentType);
  }
  if (typeof next.riskLevel === "string") {
    next.riskLevel = normalizeRiskLevel(next.riskLevel);
  }
  if (Array.isArray(next.clauses)) {
    next.clauses = next.clauses.map((clause) =>
      isRecord(clause) && typeof clause.riskLevel === "string"
        ? { ...clause, riskLevel: normalizeRiskLevel(clause.riskLevel) }
        : clause
    );
  }

  return next;
}

/**
 * Unwraps a single wrapper level like {analysis: {...}} — but only when the
 * outer object is not itself an analysis and the inner object clearly is.
 */
export function unwrapAnalysisObject(raw: unknown): unknown {
  if (!isRecord(raw) || looksLikeAnalysis(raw)) return raw;

  for (const key of WRAPPER_KEYS) {
    const inner = raw[key];
    if (isRecord(inner) && looksLikeAnalysis(inner)) return inner;
  }

  return raw;
}

/** Maps common natural-language document type phrasings onto the canonical enum. */
export function normalizeDocumentType(value: string): string {
  const cleaned = value.trim().toLowerCase();

  const canonical = ["lease", "auto", "employment", "service", "nda", "other"];
  if (canonical.includes(cleaned)) return cleaned;

  if (/\b(nda|non[- ]?disclosure|confidentiality)\b/.test(cleaned)) return "nda";
  if (/\b(lease|rental|tenancy)\b/.test(cleaned)) return "lease";
  if (/\b(employment|consulting|contractor|freelance)\b/.test(cleaned)) return "employment";
  if (/\b(service|services|vendor|saas|subscription)\b/.test(cleaned) || /\bterms of (service|use)\b/.test(cleaned)) {
    return "service";
  }
  if (/\b(auto|vehicle|car|insurance)\b/.test(cleaned)) return "auto";
  if (/\b(purchase|sales?|loan|general) (agreement|contract)\b/.test(cleaned) || cleaned === "contract" || cleaned === "agreement" || cleaned === "general contract") {
    return "other";
  }

  return value;
}

/** Maps common natural-language risk phrasings onto the canonical enum. */
export function normalizeRiskLevel(value: string): string {
  const cleaned = value.trim().toLowerCase().replace(/[\s_-]*risk$/, "").replace(/_/g, " ").trim();

  if (cleaned === "low" || cleaned === "very low" || cleaned === "minimal") return "Low";
  if (cleaned === "medium" || cleaned === "moderate" || cleaned === "mid") return "Medium";
  if (cleaned === "high" || cleaned === "very high" || cleaned === "critical" || cleaned === "severe") return "High";
  if (cleaned === "needs review" || cleaned === "review needed" || cleaned === "review") return "Needs Review";

  return value;
}

function looksLikeAnalysis(value: Record<string, unknown>): boolean {
  return ANALYSIS_SIGNATURE_KEYS.some((key) => key in value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
