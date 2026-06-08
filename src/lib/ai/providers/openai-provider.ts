import { z } from "zod";
import type { AnalysisInput } from "../provider";
import { analysisResultSchema, type AnalysisResult } from "../schema";

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

  return analyzeWithRetry(async (schemaError) => {
    const response = await postOpenAI(apiKey, options.model, input, schemaError);
    return parseJson(extractText(response));
  });
}

async function analyzeWithRetry(call: (schemaError?: string) => Promise<unknown>) {
  let raw = await call();
  const first = analysisResultSchema.safeParse(raw);
  if (first.success) return first.data;

  raw = await call(formatSchemaError(first.error));
  const second = analysisResultSchema.safeParse(raw);
  if (second.success) return second.data;

  throw new Error(`OpenAI response failed Clausly analysis schema validation: ${formatSchemaError(second.error)}`);
}

async function postOpenAI(
  apiKey: string,
  model: string,
  input: AnalysisInput,
  schemaError?: string,
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
          { role: "system", content: systemPrompt(schemaError) },
          { role: "user", content: userPrompt(input) },
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

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("OpenAI analysis response was not valid JSON.");
  }
}

function systemPrompt(schemaError?: string): string {
  return [
    "You are Clausly's contract analysis engine.",
    "Return only a JSON object matching the provided contract-analysis schema.",
    "Use ISO 8601 dates in YYYY-MM-DD format when dates are present.",
    "Use null for unknown nullable values and [] for unknown arrays.",
    "Do not include markdown, explanations, or text outside the JSON object.",
    schemaError ? `Previous JSON failed validation. Correct this schema error: ${schemaError}` : "",
  ].filter(Boolean).join("\n");
}

function userPrompt(input: AnalysisInput): string {
  return [
    `Title: ${input.title}`,
    `File name: ${input.fileName}`,
    `Jurisdiction hint: ${input.jurisdictionHint ?? "unknown"}`,
    "Document text:",
    input.text,
  ].join("\n");
}

function formatSchemaError(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ")
    .slice(0, 500);
}
