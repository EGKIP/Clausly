import { z } from "zod";

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

export function validationIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
