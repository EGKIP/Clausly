import { z } from "zod";
import { analysisResultSchema, type AnalysisResult } from "../schema";
import { normalizeAnalysisPayload } from "../normalize-analysis";
import { allowedDocumentTypes, allowedRiskLevels, analysisJsonFormatSpec } from "../analysis-format";
import { ProviderSchemaError } from "../errors";

/**
 * Shared validate-and-repair loop for real AI providers. Each response is
 * normalized (wrapper unwrap + safe enum drift repair) before strict schema
 * validation; on failure the provider is called once more with repair
 * instructions naming the exact invalid paths and the allowed enum values.
 * A response that still fails throws a typed ProviderSchemaError whose
 * message carries issue paths only — never contract text.
 */
export async function runAnalysisWithRepair(
  providerName: string,
  call: (repairInstructions?: string) => Promise<unknown>,
): Promise<AnalysisResult> {
  const first = analysisResultSchema.safeParse(normalizeAnalysisPayload(await call()));
  if (first.success) return first.data;

  const second = analysisResultSchema.safeParse(
    normalizeAnalysisPayload(await call(buildRepairInstructions(first.error)))
  );
  if (second.success) return second.data;

  throw new ProviderSchemaError(providerName, formatSchemaIssues(second.error));
}

export function buildAnalysisSystemPrompt(repairInstructions?: string): string {
  return [
    "You are Clausly's contract analysis engine.",
    "Analyze the contract like a careful document reviewer for a non-lawyer user.",
    "Prefer useful coverage over brevity: for ordinary contracts, identify roughly 8-18 material clauses when the text supports them, and more only when distinct terms truly matter.",
    "Cover obligations, payment terms, renewal or termination language, notice windows, penalties, liability, privacy/confidentiality, assignment, dispute resolution, governing law, cancellation, and unusual restrictions when present.",
    "Do not pad the output with generic clauses. Every clause must be grounded in an exact sourceText quote from the document.",
    "Make summaryLong concrete and helpful, usually 2-4 short paragraphs worth of plain-English detail.",
    "Use whyItMatters to explain the practical effect on the signer, especially for Medium, High, and Needs Review clauses.",
    "Include several riskReasons when risk exists, tied to specific terms rather than generic caution.",
    "Extract every important actionable date you can find, including past dates when they explain the contract history, but suggestedReminders should focus on dates a user could still act on.",
    "Return only a JSON object that exactly matches this contract-analysis format:",
    analysisJsonFormatSpec(),
    "Use ISO 8601 dates in YYYY-MM-DD format when dates are present.",
    "Use null for unknown nullable values and [] for unknown arrays.",
    "Do not include markdown, explanations, or text outside the JSON object.",
    repairInstructions ?? "",
  ].filter(Boolean).join("\n");
}

export function buildAnalysisUserPrompt(input: { title: string; fileName: string; jurisdictionHint?: string | null; text: string }): string {
  return [
    `Title: ${input.title}`,
    `File name: ${input.fileName}`,
    `Jurisdiction hint: ${input.jurisdictionHint ?? "unknown"}`,
    "Document text:",
    input.text,
  ].join("\n");
}

export function parseProviderJson(providerName: string, value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${providerName} analysis response was not valid JSON.`);
  }
}

export function formatSchemaIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ")
    .slice(0, 500);
}

function buildRepairInstructions(error: z.ZodError): string {
  return [
    `Previous JSON failed validation. Fix exactly these issues: ${formatSchemaIssues(error)}.`,
    `Allowed "documentType" values: ${allowedDocumentTypes().map((value) => `"${value}"`).join(", ")}.`,
    `Allowed "riskLevel" values: ${allowedRiskLevels().map((value) => `"${value}"`).join(", ")}.`,
    "Return only the corrected JSON object with no keys outside the specified format.",
  ].join("\n");
}
