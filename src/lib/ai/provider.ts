import { analysisResultSchema, type AnalysisResult } from "./schema";
import { analyzeWithMockProvider } from "./mock-provider";

export type AnalysisInput = {
  text: string;
  fileName: string;
  title: string;
  jurisdictionHint?: string | null;
};

export type AnalysisProvider = (input: AnalysisInput) => Promise<AnalysisResult>;

export type AnalysisProviderName = "mock" | "openai" | "anthropic";

export function getAnalysisProvider(): AnalysisProviderName {
  const configured = process.env.CLAUSLY_AI_PROVIDER?.toLowerCase();
  if (configured === "openai" || configured === "anthropic") return configured;
  return "mock";
}

/**
 * Run AI analysis for a document. The provider implementation is selected from
 * the CLAUSLY_AI_PROVIDER env var and defaults to the deterministic mock so
 * dev, CI, and offline runs work without vendor keys. The mock is intentionally
 * derived from the text content so smoke tests look realistic end-to-end.
 *
 * The returned value is always parsed through analysisResultSchema, so callers
 * can rely on the contract even if a future vendor implementation drifts.
 */
export async function analyzeDocument(input: AnalysisInput): Promise<AnalysisResult> {
  const provider = getAnalysisProvider();
  let raw: unknown;

  switch (provider) {
    case "openai":
    case "anthropic":
      throw new Error(`AI provider '${provider}' is not implemented yet. Set CLAUSLY_AI_PROVIDER=mock or leave it unset.`);
    case "mock":
    default:
      raw = await analyzeWithMockProvider(input);
      break;
  }

  return analysisResultSchema.parse(raw);
}
