import { z } from "zod";
import type { QAInput } from "./provider";

export function qaSystemPrompt(schemaError?: string): string {
  return [
    "You answer questions about ONE contract document using ONLY the provided excerpts.",
    "Cite the excerpt IDs you used in citationChunkIds.",
    "If the excerpts do not contain the answer, say so plainly and return an empty citationChunkIds array.",
    "Clausly provides contract intelligence and reminders, not legal advice.",
    "Return only JSON with answer and citationChunkIds.",
    schemaError ? `Previous JSON failed validation. Correct this schema error: ${schemaError}` : "",
  ].filter(Boolean).join("\n");
}

export function qaUserPrompt(input: QAInput): string {
  return [
    `Question: ${input.question}`,
    "Excerpts:",
    ...input.chunks.map((chunk) => [
      `Excerpt ID: ${chunk.id}`,
      `Page: ${chunk.pageNumber ?? "unknown"}`,
      chunk.content,
    ].join("\n")),
  ].join("\n\n");
}

export function formatSchemaError(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ")
    .slice(0, 500);
}
