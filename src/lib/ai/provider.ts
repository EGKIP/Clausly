import { analysisResultSchema, type AnalysisResult } from "./schema";
import { analyzeWithMockProvider } from "./mock-provider";
import { analyzeWithOpenAIProvider } from "./providers/openai-provider";
import { analyzeWithAnthropicProvider } from "./providers/anthropic-provider";

export type AnalysisInput = {
  text: string;
  fileName: string;
  title: string;
  jurisdictionHint?: string | null;
};

export type AnalysisProvider = (input: AnalysisInput) => Promise<AnalysisResult>;

export type AnalysisProviderName = "mock" | "openai" | "anthropic";

const DEFAULT_MODELS: Record<AnalysisProviderName, string> = {
  mock: "mock",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
};

export function getAnalysisProvider(): AnalysisProviderName {
  const configured = process.env.CLAUSLY_AI_PROVIDER?.toLowerCase();
  if (configured === "openai" || configured === "anthropic") return configured;
  return "mock";
}

export function getAnalysisModel(provider: AnalysisProviderName = getAnalysisProvider()): string {
  if (provider === "mock") return DEFAULT_MODELS.mock;
  return process.env.CLAUSLY_AI_MODEL?.trim() || DEFAULT_MODELS[provider];
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
      raw = await analyzeWithOpenAIProvider(input, { model: getAnalysisModel(provider) });
      break;
    case "anthropic":
      raw = await analyzeWithAnthropicProvider(input, { model: getAnalysisModel(provider) });
      break;
    case "mock":
    default:
      raw = await analyzeWithMockProvider(input);
      break;
  }

  return analysisResultSchema.parse(raw);
}
