import { z } from "zod";
import { formatSchemaError, qaSystemPrompt, qaUserPrompt } from "./prompts";

export type QAChunk = {
  id: string;
  content: string;
  pageNumber?: number | null;
};

export type QAMessage = {
  role: "user" | "assistant";
  content: string;
};

export type QAInput = {
  question: string;
  chunks: QAChunk[];
  history?: QAMessage[];
};

export type QAResult = {
  answer: string;
  citationChunkIds: string[];
};

export type QAProvider = (input: QAInput) => Promise<QAResult>;
export type QAProviderName = "mock" | "openai";

const qaResultSchema = z.object({
  answer: z.string().min(1).max(4000),
  citationChunkIds: z.array(z.string()).max(5),
}).strict();

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const TIMEOUT_MS = 60_000;

export function getQAProvider(): QAProvider {
  const provider = getQAProviderName();
  if (provider === "openai") return answerWithOpenAIProvider;
  return answerWithMockProvider;
}

export function getQAProviderName(): QAProviderName {
  const aiProvider = process.env.CLAUSLY_AI_PROVIDER?.trim().toLowerCase();
  if (aiProvider === "openai") return "openai";

  return "mock";
}

export function getQAModel(): string {
  return process.env.CLAUSLY_AI_MODEL?.trim() || "gpt-4o-mini";
}

export async function answerWithMockProvider(input: QAInput): Promise<QAResult> {
  const firstChunk = input.chunks[0];
  if (!firstChunk) {
    return {
      answer: "I could not find indexed excerpts for this document yet.",
      citationChunkIds: [],
    };
  }

  return {
    answer: `Based on the indexed document excerpts, the most relevant passage says: ${firstChunk.content.slice(0, 220)}`,
    citationChunkIds: [firstChunk.id],
  };
}

export async function answerWithOpenAIProvider(input: QAInput): Promise<QAResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI QA provider requires OPENAI_API_KEY.");
  }

  return answerWithRetry(async (schemaError) => {
    const response = await postOpenAI(apiKey, getQAModel(), input, schemaError);
    return parseJson(extractText(response));
  });
}

async function answerWithRetry(call: (schemaError?: string) => Promise<unknown>): Promise<QAResult> {
  let raw = await call();
  const first = qaResultSchema.safeParse(raw);
  if (first.success) return first.data;

  raw = await call(formatSchemaError(first.error));
  const second = qaResultSchema.safeParse(raw);
  if (second.success) return second.data;

  throw new Error(`OpenAI QA response failed Clausly schema validation: ${formatSchemaError(second.error)}`);
}

async function postOpenAI(
  apiKey: string,
  model: string,
  input: QAInput,
  schemaError?: string,
): Promise<{ output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }> {
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
          { role: "system", content: qaSystemPrompt(schemaError) },
          { role: "user", content: qaUserPrompt(input) },
        ],
        text: { format: { type: "json_object" } },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI QA request failed with HTTP ${response.status}.`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OpenAI QA request timed out after 60 seconds.");
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

  if (!text) throw new Error("OpenAI QA response did not include JSON text.");
  return text;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("OpenAI QA response was not valid JSON.");
  }
}
