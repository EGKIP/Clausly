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
  fire_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD.").optional(),
  reminder_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected HH:mm or HH:mm:ss.").nullable().optional(),
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
