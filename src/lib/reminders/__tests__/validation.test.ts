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

  it("rejects fire_on dates that are not real calendar dates", () => {
    expect(reminderPatchLifecycleSchema.safeParse({ fire_on: "2026-02-30" }).success).toBe(false);
    expect(reminderPatchLifecycleSchema.safeParse({ fire_on: "2026-13-01" }).success).toBe(false);
    expect(reminderPatchLifecycleSchema.safeParse({ fire_on: "2026-02-28" }).success).toBe(true);
  });

  it("rejects fire_on year zero, which Postgres has no representation for", () => {
    expect(reminderPatchLifecycleSchema.safeParse({ fire_on: "0000-01-01" }).success).toBe(false);
    expect(reminderPatchLifecycleSchema.safeParse({ fire_on: "0000-02-29" }).success).toBe(false);
  });

  it("rejects reminder_time values with an out-of-range hour or minute", () => {
    expect(reminderPatchLifecycleSchema.safeParse({ reminder_time: "09:30" }).success).toBe(true);
    expect(reminderPatchLifecycleSchema.safeParse({ reminder_time: "23:59:59" }).success).toBe(true);
    expect(reminderPatchLifecycleSchema.safeParse({ reminder_time: "24:00" }).success).toBe(false);
    expect(reminderPatchLifecycleSchema.safeParse({ reminder_time: "12:60" }).success).toBe(false);
    expect(reminderPatchLifecycleSchema.safeParse({ reminder_time: "99:99" }).success).toBe(false);
  });

  it("maps API dismissed status to the current database enum", () => {
    const parsed = reminderListQuerySchema.parse({ status: "dismissed" });

    expect(parsed.status).toBe("dismissed");
    expect(toDbStatus("dismissed")).toBe("ignored");
  });
});
