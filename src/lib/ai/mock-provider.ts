import type { AnalysisInput } from "./provider";
import type { AnalysisResult } from "./schema";

type DocTypeHint = "lease" | "auto" | "employment" | "service" | "nda" | "other";

const TYPE_KEYWORDS: Record<DocTypeHint, RegExp> = {
  lease: /\b(lease|tenant|landlord|rent|premises|leasehold)\b/i,
  auto: /\b(policy|insured|premium|coverage|deductible|claim)\b/i,
  employment: /\b(employee|employer|salary|wages|termination|severance|at-will)\b/i,
  nda: /\b(confidential|non-disclosure|nda|proprietary|trade secret)\b/i,
  service: /\b(services|statement of work|deliverables|engagement|consultant|sow)\b/i,
  other: /.^/,
};

const TYPE_DEFAULTS: Record<DocTypeHint, { title: string; tag: string; jurisdiction: string | null }> = {
  lease: { title: "Lease agreement", tag: "Lease", jurisdiction: "Minnesota" },
  auto: { title: "Insurance policy", tag: "Insurance", jurisdiction: null },
  employment: { title: "Employment agreement", tag: "Employment", jurisdiction: null },
  nda: { title: "Non-disclosure agreement", tag: "NDA", jurisdiction: "Delaware" },
  service: { title: "Service agreement", tag: "Service", jurisdiction: null },
  other: { title: "Contract", tag: "Contract", jurisdiction: null },
};

function detectType(text: string): DocTypeHint {
  for (const type of ["lease", "auto", "employment", "nda", "service"] as DocTypeHint[]) {
    if (TYPE_KEYWORDS[type].test(text)) return type;
  }
  return "other";
}

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickConfidence(seed: number, base: number): number {
  const jitter = ((seed % 17) - 8) / 100;
  return Math.min(0.98, Math.max(0.55, Number((base + jitter).toFixed(2))));
}

function inferDates(text: string, fallbackYear: number): { effective: string; end: string } {
  const isoMatches = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/g) ?? [];
  const first = isoMatches[0];
  const second = isoMatches[1];
  if (first && second) return { effective: first, end: second };
  if (first) return { effective: first, end: `${fallbackYear + 1}-12-31` };
  return { effective: `${fallbackYear}-09-01`, end: `${fallbackYear + 1}-08-31` };
}

function inferMonthlyValue(text: string): number | null {
  const matches = text.match(/\$\s?([0-9]{2,5}(?:[.,][0-9]{2})?)/g);
  if (!matches || matches.length === 0) return null;
  const parsed = Number.parseFloat(matches[0].replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export async function analyzeWithMockProvider(input: AnalysisInput): Promise<AnalysisResult> {
  const type = detectType(input.text);
  const defaults = TYPE_DEFAULTS[type];
  const seed = stableHash(`${input.title}|${input.fileName}|${input.text.length}`);
  const fallbackYear = new Date().getUTCFullYear();
  const dates = inferDates(input.text, fallbackYear);
  const monthlyValue = type === "lease" || type === "service" ? inferMonthlyValue(input.text) : null;
  const riskLevel = type === "nda" ? "Needs Review" : type === "auto" ? "Low" : "Medium";
  const noticeWindowDays = type === "lease" ? 60 : type === "auto" ? 30 : null;

  return {
    documentTitle: input.title || defaults.title,
    documentType: type,
    jurisdiction: input.jurisdictionHint ?? defaults.jurisdiction,
    summaryShort: `Likely a ${defaults.title.toLowerCase()}. Review the highlighted clauses and dates before signing or renewing.`,
    summaryLong: `This document was analyzed using Clausly's deterministic preview model. It identified ${defaults.title.toLowerCase()} language including terms, obligations, and at least one important date. Verify every extracted item against the original PDF — AI output is a starting point, not a final answer.`,
    riskLevel,
    riskReasons: [
      `Auto-detected as ${defaults.title.toLowerCase()} based on document language.`,
      "Confidence is preview-grade and should be re-checked by the reader.",
    ],
    pageCount: null,
    monthlyValue,
    effectiveDate: dates.effective,
    endDate: dates.end,
    noticeWindowDays,
    tags: ["AI Preview", defaults.tag],
    clauses: [
      {
        title: type === "lease" ? "Notice window" : type === "nda" ? "Confidentiality period" : "Termination terms",
        category: type === "lease" ? "Renewal" : type === "nda" ? "Privacy" : "Termination",
        riskLevel,
        sourcePage: 1,
        sourceText: input.text.slice(0, 280) || "Source text unavailable in mock provider.",
        plainEnglish: type === "lease"
          ? "Notice typically must be provided in writing before the term ends."
          : type === "nda"
          ? "Confidentiality obligations usually continue after the engagement ends."
          : "Either party may end the agreement under defined conditions.",
        whyItMatters: "Missing this clause window can trigger renewal or extended obligations.",
        confidence: pickConfidence(seed, 0.82),
      },
    ],
    importantDates: [
      {
        title: type === "lease" ? "Lease end date" : type === "auto" ? "Policy renewal date" : "Agreement end date",
        date: dates.end,
        description: "Auto-detected end-of-term date. Verify against the document.",
        sourcePage: null,
        sourceText: "",
        kind: type === "auto" ? ("renewal" as const) : type === "lease" ? ("end" as const) : ("deadline" as const),
        confidence: pickConfidence(seed + 1, 0.86),
      },
    ],
    suggestedReminders: [
      {
        title: type === "lease" ? "Send non-renewal notice" : type === "auto" ? "Review policy before renewal" : "Review contract before end date",
        date: shiftDate(dates.end, type === "lease" ? -60 : type === "auto" ? -30 : -14),
        description: "Suggested by Clausly. Approve, edit, or ignore before it fires.",
        type: type === "lease" ? "Notice" : type === "auto" ? "Renewal" : "Review",
        defaultReminderOffsets: ["30_days_before", "7_days_before"],
        sourceText: "",
        confidence: pickConfidence(seed + 2, 0.78),
      },
    ],
  };
}

function shiftDate(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
