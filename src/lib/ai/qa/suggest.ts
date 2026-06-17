import "server-only";

import { z } from "zod";
import { getQAModel, getQAProviderName, type QAChunk } from "./provider";
import { formatSchemaError } from "./prompts";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const TIMEOUT_MS = 60_000;

const suggestionsSchema = z.array(z.string().trim().min(8).max(90)).length(4);

const mockDocumentSuggestions = [
  "What's the termination clause?",
  "When does this auto-renew?",
  "What notice period applies?",
  "Which fees could surprise me?",
];

const mockPortfolioSuggestions = [
  "Which contracts renew soon?",
  "Where is my highest monthly cost?",
  "Which agreements need notice?",
  "Which risks appear across documents?",
];

export async function generateDocumentSuggestions(chunks: QAChunk[]): Promise<string[]> {
  if (getQAProviderName() !== "openai") return mockDocumentSuggestions;
  return generateWithOpenAI("document", chunks);
}

export async function generatePortfolioSuggestions(chunks: QAChunk[]): Promise<string[]> {
  if (getQAProviderName() !== "openai") return mockPortfolioSuggestions;
  return generateWithOpenAI("portfolio", chunks);
}

export function parseSuggestionResponse(value: unknown): string[] {
  const payload = Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null && Array.isArray((value as { suggestions?: unknown }).suggestions)
      ? (value as { suggestions: unknown[] }).suggestions
      : value;
  return suggestionsSchema.parse(payload);
}

async function generateWithOpenAI(scope: "document" | "portfolio", chunks: QAChunk[], schemaError?: string): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI suggestion provider requires OPENAI_API_KEY.");

  const first = await callOpenAI(apiKey, scope, chunks, schemaError);
  const firstParsed = safeParseSuggestions(first);
  if (firstParsed.success) return firstParsed.data;

  const second = await callOpenAI(apiKey, scope, chunks, formatSchemaError(firstParsed.error));
  const secondParsed = safeParseSuggestions(second);
  if (secondParsed.success) return secondParsed.data;

  throw new Error(`OpenAI suggestion response failed schema validation: ${formatSchemaError(secondParsed.error)}`);
}

function safeParseSuggestions(value: unknown) {
  const payload = Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null && Array.isArray((value as { suggestions?: unknown }).suggestions)
      ? (value as { suggestions: unknown[] }).suggestions
      : value;
  return suggestionsSchema.safeParse(payload);
}

async function callOpenAI(apiKey: string, scope: "document" | "portfolio", chunks: QAChunk[], schemaError?: string): Promise<unknown> {
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
        model: getQAModel(),
        input: [
          {
            role: "system",
            content: [
              scope === "portfolio"
                ? "Generate exactly 4 short starter questions grounded in these excerpts from a contract portfolio."
                : "Generate exactly 4 short starter questions grounded in these excerpts from one contract.",
              "Each question must be open-ended, useful to a non-lawyer, 8 to 14 words, and at most 90 characters.",
              "Return only JSON shaped as {\"suggestions\":[\"...\"]}.",
              schemaError ? `Previous JSON failed validation. Correct this schema error: ${schemaError}` : "",
            ].filter(Boolean).join("\n"),
          },
          {
            role: "user",
            content: chunks.map((chunk) => [
              `Excerpt ID: ${chunk.id}`,
              `Page: ${chunk.pageNumber ?? "unknown"}`,
              chunk.content,
            ].join("\n")).join("\n\n"),
          },
        ],
        text: { format: { type: "json_object" } },
      }),
    });

    if (!response.ok) throw new Error(`OpenAI suggestion request failed with HTTP ${response.status}.`);
    const json = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    return parseJson(extractText(json));
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OpenAI suggestion request timed out after 60 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractText(response: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }): string {
  if (response.output_text) return response.output_text;
  const text = response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find((value): value is string => Boolean(value));
  if (!text) throw new Error("OpenAI suggestion response did not include JSON text.");
  return text;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("OpenAI suggestion response was not valid JSON.");
  }
}
