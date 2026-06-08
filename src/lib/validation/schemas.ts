import { z } from "zod";
import type { ReminderOffset } from "@/lib/ai/schema";

const reminderOffsetValues = [
  "1_day_before",
  "7_days_before",
  "14_days_before",
  "30_days_before",
  "60_days_before",
  "90_days_before",
] as const satisfies readonly ReminderOffset[];

export const documentTypeSchema = z.enum([
  "lease",
  "auto",
  "employment",
  "service",
  "nda",
  "other",
]);

export const reminderStatusSchema = z.enum([
  "suggested",
  "approved",
  "sent",
  "ignored",
]);

export const reminderTypeSchema = z.enum([
  "Renewal",
  "Notice",
  "Payment",
  "Review",
]);

export const reminderChannelSchema = z.enum(["Email"]).default("Email");

const notificationPreferenceDefaultsSchema = z.object({
  renewal_offsets: z.array(z.enum(reminderOffsetValues)).optional(),
  notice_offsets: z.array(z.enum(reminderOffsetValues)).optional(),
  payment_offsets: z.array(z.enum(reminderOffsetValues)).optional(),
  review_offsets: z.array(z.enum(reminderOffsetValues)).optional(),
}).strict();

export const notificationPreferencesSchema = z.object({
  email: z.boolean().default(true),
  version: z.number().int().min(0).optional(),
  defaults: notificationPreferenceDefaultsSchema.optional(),
}).strict();

export const iso8601DateSchema = z.string().refine(
  (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  },
  { message: "Expected an ISO 8601 date in YYYY-MM-DD format." }
);

export function boundedTextSchema(min: number, max: number) {
  return z.string().trim().min(min).max(max);
}

export const reminderCreateSchema = z.object({
  documentId: z.string().uuid(),
  dateId: z.string().uuid().nullable().optional(),
  title: boundedTextSchema(1, 120),
  description: boundedTextSchema(0, 500).default(""),
  fireOn: iso8601DateSchema,
  type: reminderTypeSchema.default("Review"),
  channel: reminderChannelSchema,
}).strict();

export const reminderPatchSchema = reminderCreateSchema
  .partial()
  .extend({ status: reminderStatusSchema.optional() })
  .strict();

export function validationIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
