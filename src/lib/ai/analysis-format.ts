import { documentTypeSchema, reminderTypeSchema } from "@/lib/validation/schemas";
import { aiRiskLevelSchema, analysisDateKindSchema, reminderOffsetSchema } from "./schema";

/**
 * The model-facing description of the analysis JSON format. Built from the
 * same Zod enums that validate the response, so the prompt and the schema
 * cannot drift apart. Keep this in sync with analysisResultSchema's shape —
 * field names and nesting here are what the model will produce.
 */
export function analysisJsonFormatSpec(): string {
  const documentTypes = quoteList(documentTypeSchema.options);
  const riskLevels = quoteList(aiRiskLevelSchema.options);
  const dateKinds = quoteList(analysisDateKindSchema.options);
  const reminderTypes = quoteList(reminderTypeSchema.options);
  const reminderOffsets = quoteList(reminderOffsetSchema.options);

  return [
    "{",
    '  "documentTitle": string,                     // 1-200 chars',
    `  "documentType": ${documentTypes},`,
    '  "jurisdiction": string | null,               // e.g. "Minnesota", null if unknown',
    '  "summaryShort": string,                      // 1-600 chars, plain English',
    '  "summaryLong": string,                       // up to 4000 chars, "" if none',
    `  "riskLevel": ${riskLevels},`,
    '  "riskReasons": string[],                     // up to 20 short reasons',
    '  "pageCount": integer | null,',
    '  "monthlyValue": number | null,               // non-negative, null if unknown',
    '  "effectiveDate": "YYYY-MM-DD" | null,',
    '  "endDate": "YYYY-MM-DD" | null,',
    '  "noticeWindowDays": integer | null,          // 0-3650',
    '  "tags": string[],                            // up to 12 short tags',
    '  "clauses": [{                                // up to 50',
    '    "title": string,                           // 1-160 chars',
    '    "category": string,                        // e.g. "Termination", "Payment"',
    `    "riskLevel": ${riskLevels},`,
    '    "sourcePage": integer,                     // 1-based page number',
    '    "sourceText": string,                      // exact quote, 1-2000 chars',
    '    "plainEnglish": string,                    // 1-2000 chars',
    '    "whyItMatters": string,                    // "" if none',
    '    "confidence": number                       // 0-1',
    "  }],",
    '  "importantDates": [{                         // up to 50',
    '    "title": string,',
    '    "date": "YYYY-MM-DD",',
    '    "description": string,                     // "" if none',
    '    "sourcePage": integer | null,',
    '    "sourceText": string,                      // "" if none',
    `    "kind": ${dateKinds},`,
    '    "confidence": number                       // 0-1',
    "  }],",
    '  "suggestedReminders": [{                     // up to 20',
    '    "title": string,',
    '    "date": "YYYY-MM-DD",',
    '    "description": string,                     // "" if none',
    `    "type": ${reminderTypes},`,
    `    "defaultReminderOffsets": array of ${reminderOffsets},`,
    '    "sourceText": string,                      // "" if none',
    '    "confidence": number                       // 0-1',
    "  }]",
    "}",
    "Every enum field must use one of its listed values exactly as written (matching case).",
    "Do not add any keys that are not listed above.",
  ].join("\n");
}

export function allowedDocumentTypes(): readonly string[] {
  return documentTypeSchema.options;
}

export function allowedRiskLevels(): readonly string[] {
  return aiRiskLevelSchema.options;
}

function quoteList(values: readonly string[]): string {
  return values.map((value) => `"${value}"`).join(" | ");
}
