import { z } from "zod";
import type { QAInput, QAMessage } from "./provider";

export function qaSystemPrompt(schemaError?: string): string {
  return [
    "You answer questions about ONE contract document using ONLY the provided excerpts.",
    "You may reference prior turns in the conversation when relevant, but always ground answers in the provided excerpts.",
    "Cite the excerpt IDs you used in citationChunkIds.",
    "If the excerpts do not contain the answer, say so plainly and return an empty citationChunkIds array.",
    "Clausly provides contract intelligence and reminders, not legal advice.",
    "Return only JSON with answer and citationChunkIds.",
    schemaError ? `Previous JSON failed validation. Correct this schema error: ${schemaError}` : "",
  ].filter(Boolean).join("\n");
}

export function qaStreamingSystemPrompt(): string {
  return [
    "You answer questions about ONE contract document using ONLY the provided excerpts.",
    "You may reference prior turns in the conversation when relevant, but always ground answers in the provided excerpts.",
    "Answer in plain, readable prose for the user interface.",
    "Do not output JSON, markdown code fences, excerpt IDs, or citationChunkIds.",
    "If the excerpts do not contain the answer, say so plainly.",
    "Clausly provides contract intelligence and reminders, not legal advice.",
  ].join("\n");
}

export function qaUserPrompt(input: QAInput): string {
  return qaUserPromptWithHistory(input);
}

export function qaUserPromptWithHistory(input: QAInput & { history?: QAMessage[] }): string {
  return [
    formatHistory(input.history ?? []),
    `Question: ${input.question}`,
    "Excerpts:",
    ...input.chunks.map((chunk) => [
      `Excerpt ID: ${chunk.id}`,
      `Page: ${chunk.pageNumber ?? "unknown"}`,
      chunk.content,
    ].join("\n")),
  ].filter(Boolean).join("\n\n");
}

export function compactHistory(messages: QAMessage[]): QAMessage[] {
  const recent = messages.slice(-12);
  const selected: QAMessage[] = [];
  let approxChars = 0;

  for (const message of recent.slice().reverse()) {
    const nextChars = message.content.length;
    if (selected.length >= 12 || approxChars + nextChars > 16_000) break;
    selected.unshift(message);
    approxChars += nextChars;
  }

  return selected;
}

function formatHistory(history: QAMessage[]) {
  const compact = compactHistory(history);
  if (compact.length === 0) return "";

  return [
    "Prior conversation turns:",
    ...compact.map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`),
  ].join("\n");
}

export function formatSchemaError(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ")
    .slice(0, 500);
}
