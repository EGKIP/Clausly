import { describe, expect, it } from "vitest";
import { reminderListQuerySchema, reminderPatchLifecycleSchema, toDbStatus } from "../validation";

describe("reminder lifecycle validation", () => {
  it("accepts lifecycle patch fields and rejects status mutation", () => {
    expect(reminderPatchLifecycleSchema.safeParse({
      title: "Renewal",
      description: "",
      fire_on: "2026-11-01",
      reminder_time: "09:30",
    }).success).toBe(true);

    expect(reminderPatchLifecycleSchema.safeParse({ status: "approved" }).success).toBe(false);
  });

  it("maps API dismissed status to the current database enum", () => {
    const parsed = reminderListQuerySchema.parse({ status: "dismissed" });

    expect(parsed.status).toBe("dismissed");
    expect(toDbStatus("dismissed")).toBe("ignored");
  });
});
