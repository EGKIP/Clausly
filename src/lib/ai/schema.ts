import { z } from "zod";
import { documentTypeSchema, iso8601DateSchema, reminderTypeSchema } from "@/lib/validation/schemas";

export const aiRiskLevelSchema = z.enum(["Low", "Medium", "High", "Needs Review"]);

export const reminderOffsetSchema = z.enum([
  "1_day_before",
  "7_days_before",
  "14_days_before",
  "30_days_before",
  "60_days_before",
  "90_days_before",
]);

export const analysisClauseSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(60),
  riskLevel: aiRiskLevelSchema,
  sourcePage: z.number().int().min(1),
  sourceText: z.string().trim().min(1).max(2000),
  plainEnglish: z.string().trim().min(1).max(2000),
  whyItMatters: z.string().trim().min(0).max(2000).default(""),
  confidence: z.number().min(0).max(1),
}).strict();

export const analysisDateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  date: iso8601DateSchema,
  description: z.string().trim().min(0).max(2000).default(""),
  sourcePage: z.number().int().min(1).nullable().default(null),
  sourceText: z.string().trim().min(0).max(2000).default(""),
  kind: z.enum(["deadline", "renewal", "notice", "payment", "effective", "end", "review"]).default("deadline"),
  confidence: z.number().min(0).max(1),
}).strict();

export const analysisReminderSchema = z.object({
  title: z.string().trim().min(1).max(160),
  date: iso8601DateSchema,
  description: z.string().trim().min(0).max(2000).default(""),
  type: reminderTypeSchema.default("Review"),
  defaultReminderOffsets: z.array(reminderOffsetSchema).default([]),
  sourceText: z.string().trim().min(0).max(2000).default(""),
  confidence: z.number().min(0).max(1),
}).strict();

export const analysisResultSchema = z.object({
  documentTitle: z.string().trim().min(1).max(200),
  documentType: documentTypeSchema,
  jurisdiction: z.string().trim().min(0).max(120).nullable().default(null),
  summaryShort: z.string().trim().min(1).max(600),
  summaryLong: z.string().trim().min(0).max(4000).default(""),
  riskLevel: aiRiskLevelSchema,
  riskReasons: z.array(z.string().trim().min(1).max(400)).max(20).default([]),
  pageCount: z.number().int().min(1).nullable().default(null),
  monthlyValue: z.number().nonnegative().nullable().default(null),
  effectiveDate: iso8601DateSchema.nullable().default(null),
  endDate: iso8601DateSchema.nullable().default(null),
  noticeWindowDays: z.number().int().min(0).max(3650).nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  clauses: z.array(analysisClauseSchema).max(50).default([]),
  importantDates: z.array(analysisDateSchema).max(50).default([]),
  suggestedReminders: z.array(analysisReminderSchema).max(20).default([]),
}).strict();

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type AnalysisClause = z.infer<typeof analysisClauseSchema>;
export type AnalysisDate = z.infer<typeof analysisDateSchema>;
export type AnalysisReminder = z.infer<typeof analysisReminderSchema>;
export type AnalysisRiskLevel = z.infer<typeof aiRiskLevelSchema>;
export type ReminderOffset = z.infer<typeof reminderOffsetSchema>;
