import { z } from "zod";
import type { QAMessage, QAResult } from "./provider";
import { compactHistory } from "./prompts";
import { parseOpenAISse, type QAStreamEvent } from "./stream";

export type PortfolioQAChunk = {
  id: string;
  documentId: string;
  documentTitle: string;
  content: string;
  pageNumber?: number | null;
};

export type PortfolioQAInput = {
  question: string;
  chunks: PortfolioQAChunk[];
  history?: QAMessage[];
};

export type PortfolioQAProvider = (input: PortfolioQAInput) => Promise<QAResult>;

const qaResultSchema = z.object({
  answer: z.string().min(1).max(4000),
  citationChunkIds: z.array(z.string()).max(12),
}).strict();

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const TIMEOUT_MS = 60_000;

export function getPortfolioQAProvider(): PortfolioQAProvider {
  if (process.env.CLAUSLY_AI_PROVIDER?.trim().toLowerCase() === "openai") {
    return answerPortfolioWithOpenAIProvider;
  }
  return answerPortfolioWithMockProvider;
}

export function getPortfolioQAStreamProvider(): (input: PortfolioQAInput) => AsyncIterable<QAStreamEvent> {
  if (process.env.CLAUSLY_AI_PROVIDER?.trim().toLowerCase() === "openai") {
    return streamPortfolioWithOpenAIProvider;
  }
  return (input) => streamPortfolioWithMockProvider(input);
}

export async function answerPortfolioWithMockProvider(input: PortfolioQAInput): Promise<QAResult> {
  const firstChunk = input.chunks[0];
  if (!firstChunk) {
    return {
      answer: "I could not find indexed excerpts across your portfolio yet.",
      citationChunkIds: [],
    };
  }

  return {
    answer: `Across your portfolio, ${firstChunk.documentTitle} has the most relevant excerpt: ${firstChunk.content.slice(0, 220)}`,
    citationChunkIds: [firstChunk.id],
  };
}

export async function answerPortfolioWithOpenAIProvider(input: PortfolioQAInput): Promise<QAResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI portfolio QA provider requires OPENAI_API_KEY.");
  }

  return answerWithRetry(async (schemaError) => {
    const response = await postOpenAIJson(apiKey, getQAModel(), input, schemaError);
    return parseJson(extractText(response));
  });
}

export async function* streamPortfolioWithMockProvider(
  input: PortfolioQAInput,
  options: { delayMs?: number } = {},
): AsyncIterable<QAStreamEvent> {
  const result = await answerPortfolioWithMockProvider(input);
  const words = result.answer.split(/\s+/).filter(Boolean);

  for (const [index, word] of words.entries()) {
    if ((options.delayMs ?? 10) > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs ?? 10));
    }
    yield { type: "token", text: index === 0 ? word : ` ${word}` };
  }

  yield { type: "done" };
}

export async function* streamPortfolioWithOpenAIProvider(input: PortfolioQAInput): AsyncIterable<QAStreamEvent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    yield { type: "error", message: "OpenAI portfolio QA streaming provider requires OPENAI_API_KEY." };
    return;
  }

  let response: Response;
  try {
    response = await postOpenAI(apiKey, getQAModel(), input, undefined, true);
  } catch (error) {
    yield { type: "error", message: error instanceof Error ? error.message : "OpenAI portfolio QA streaming request failed." };
    return;
  }

  if (!response.ok) {
    yield { type: "error", message: `OpenAI portfolio QA streaming request failed with HTTP ${response.status}.` };
    return;
  }

  if (!response.body) {
    yield { type: "error", message: "OpenAI portfolio QA streaming response did not include a body." };
    return;
  }

  for await (const event of parseOpenAISse(response.body)) {
    yield event;
    if (event.type === "done" || event.type === "error") return;
  }

  yield { type: "done" };
}

async function answerWithRetry(call: (schemaError?: string) => Promise<unknown>): Promise<QAResult> {
  let raw = await call();
  const first = qaResultSchema.safeParse(raw);
  if (first.success) return first.data;

  raw = await call(formatSchemaError(first.error));
  const second = qaResultSchema.safeParse(raw);
  if (second.success) return second.data;

  throw new Error(`OpenAI portfolio QA response failed Clausly schema validation: ${formatSchemaError(second.error)}`);
}

function getQAModel(): string {
  return process.env.CLAUSLY_AI_MODEL?.trim() || "gpt-4o-mini";
}

async function postOpenAI(
  apiKey: string,
  model: string,
  input: PortfolioQAInput,
  schemaError?: string,
  stream = false,
): Promise<Response> {
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
        ...(stream ? { stream: true } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI portfolio QA request failed with HTTP ${response.status}.`);
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OpenAI portfolio QA request timed out after 60 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function postOpenAIJson(
  apiKey: string,
  model: string,
  input: PortfolioQAInput,
  schemaError?: string,
): Promise<{ output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }> {
  const response = await postOpenAI(apiKey, model, input, schemaError);
  return await response.json();
}

function systemPrompt(schemaError?: string): string {
  return [
    "You answer questions across MULTIPLE contract documents using ONLY the provided excerpts.",
    "You may reference prior turns in the conversation when relevant, but always ground answers in the provided excerpts.",
    "Each excerpt includes an excerpt ID, document title, optional page number, and excerpt text.",
    "Cite every excerpt ID you used in citationChunkIds.",
    "If the excerpts do not contain the answer, say so plainly and return an empty citationChunkIds array.",
    "Clausly provides contract intelligence and reminders, not legal advice.",
    "Return only JSON with answer and citationChunkIds.",
    schemaError ? `Previous JSON failed validation. Correct this schema error: ${schemaError}` : "",
  ].filter(Boolean).join("\n");
}

function userPrompt(input: PortfolioQAInput): string {
  return [
    formatHistory(input.history ?? []),
    `Question: ${input.question}`,
    "Portfolio excerpts:",
    ...input.chunks.map((chunk) => [
      `Excerpt ID: ${chunk.id}`,
      `Document: ${chunk.documentTitle}`,
      `Document ID: ${chunk.documentId}`,
      `Page: ${chunk.pageNumber ?? "unknown"}`,
      chunk.content,
    ].join("\n")),
  ].filter(Boolean).join("\n\n");
}

function formatHistory(history: QAMessage[]) {
  const compact = compactHistory(history);
  if (compact.length === 0) return "";
  return [
    "Prior conversation turns:",
    ...compact.map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`),
  ].join("\n");
}

function extractText(response: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }): string {
  if (response.output_text) return response.output_text;

  const text = response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find((value): value is string => Boolean(value));

  if (!text) throw new Error("OpenAI portfolio QA response did not include JSON text.");
  return text;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("OpenAI portfolio QA response was not valid JSON.");
  }
}

function formatSchemaError(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ")
    .slice(0, 500);
}
