import { z } from "zod";

export const reminderDbStatusSchema = z.enum(["suggested", "approved", "sent", "ignored"]);
export const reminderApiStatusSchema = z.enum(["suggested", "approved", "sent", "ignored", "dismissed"]);

export const reminderListQuerySchema = z.object({
  status: reminderApiStatusSchema.optional(),
  document_id: z.string().uuid().optional(),
});

export const reminderLifecycleFieldsSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  fire_on: z.string()
    .date("Expected a valid date in YYYY-MM-DD format.")
    // z.string().date() accepts the year-zero edge case (0000-01-01), but
    // Postgres has no year zero and rejects it, so reject it here too.
    .refine((value) => Number(value.slice(0, 4)) > 0, "Expected a valid date in YYYY-MM-DD format.")
    .optional(),
  reminder_time: z.string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Expected a valid HH:mm or HH:mm:ss time.")
    .nullable()
    .optional(),
}).strict();

export const reminderPatchLifecycleSchema = reminderLifecycleFieldsSchema.refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one reminder field is required." }
);

export const reminderApproveSchema = reminderLifecycleFieldsSchema;

export function toDbStatus(status: z.infer<typeof reminderApiStatusSchema>) {
  return status === "dismissed" ? "ignored" : status;
}

export function validationIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
