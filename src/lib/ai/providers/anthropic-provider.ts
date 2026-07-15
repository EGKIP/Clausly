import type { AnalysisInput } from "../provider";
import type { AnalysisResult } from "../schema";
import {
  buildAnalysisSystemPrompt,
  buildAnalysisUserPrompt,
  parseProviderJson,
  runAnalysisWithRepair,
} from "./analysis-response";

type ProviderOptions = {
  model: string;
};

type AnthropicResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 60_000;

export async function analyzeWithAnthropicProvider(
  input: AnalysisInput,
  options: ProviderOptions,
): Promise<AnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Anthropic provider is implemented but ANTHROPIC_API_KEY is missing, so real calls are not implemented for this environment.");
  }

  return runAnalysisWithRepair("Anthropic", async (repairInstructions) => {
    const response = await postAnthropic(apiKey, options.model, input, repairInstructions);
    return parseProviderJson("Anthropic", extractText(response));
  });
}

async function postAnthropic(
  apiKey: string,
  model: string,
  input: AnalysisInput,
  repairInstructions?: string,
): Promise<AnthropicResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: buildAnalysisSystemPrompt(repairInstructions),
        messages: [{ role: "user", content: buildAnalysisUserPrompt(input) }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic analysis request failed with HTTP ${response.status}.`);
    }

    return await response.json() as AnthropicResponse;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Anthropic analysis request timed out after 60 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractText(response: AnthropicResponse): string {
  const text = response.content
    ?.map((content) => content.text)
    .find((value): value is string => Boolean(value));

  if (!text) throw new Error("Anthropic analysis response did not include JSON text.");
  return text;
}
