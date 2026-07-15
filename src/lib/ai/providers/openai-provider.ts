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

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const TIMEOUT_MS = 60_000;

export async function analyzeWithOpenAIProvider(
  input: AnalysisInput,
  options: ProviderOptions,
): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI provider is implemented but OPENAI_API_KEY is missing, so real calls are not implemented for this environment.");
  }

  return runAnalysisWithRepair("OpenAI", async (repairInstructions) => {
    const response = await postOpenAI(apiKey, options.model, input, repairInstructions);
    return parseProviderJson("OpenAI", extractText(response));
  });
}

async function postOpenAI(
  apiKey: string,
  model: string,
  input: AnalysisInput,
  repairInstructions?: string,
): Promise<OpenAIResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: buildAnalysisSystemPrompt(repairInstructions) },
          { role: "user", content: buildAnalysisUserPrompt(input) },
        ],
        text: { format: { type: "json_object" } },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI analysis request failed with HTTP ${response.status}.`);
    }

    return await response.json() as OpenAIResponse;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OpenAI analysis request timed out after 60 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractText(response: OpenAIResponse): string {
  if (response.output_text) return response.output_text;

  const text = response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find((value): value is string => Boolean(value));

  if (!text) throw new Error("OpenAI analysis response did not include JSON text.");
  return text;
}
