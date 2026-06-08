import { describe, expect, it } from "vitest";
import {
  boundedTextSchema,
  documentTypeSchema,
  iso8601DateSchema,
  notificationPreferencesSchema,
  reminderChannelSchema,
  reminderCreateSchema,
  reminderPatchSchema,
  reminderStatusSchema,
  reminderTypeSchema,
} from "../schemas";

describe("validation schemas", () => {
  it("validates document types", () => {
    expect(documentTypeSchema.parse("lease")).toBe("lease");
    expect(documentTypeSchema.safeParse("Lease").success).toBe(false);
    expect(documentTypeSchema.safeParse("mortgage").success).toBe(false);
  });

  it("validates reminder statuses", () => {
    expect(reminderStatusSchema.parse("approved")).toBe("approved");
    expect(reminderStatusSchema.safeParse("deleted").success).toBe(false);
    expect(reminderStatusSchema.safeParse(1).success).toBe(false);
  });

  it("validates reminder types", () => {
    expect(reminderTypeSchema.parse("Notice")).toBe("Notice");
    expect(reminderTypeSchema.safeParse("notice").success).toBe(false);
    expect(reminderTypeSchema.safeParse("Deadline").success).toBe(false);
  });

  it("validates reminder channels", () => {
    expect(reminderChannelSchema.parse("Email")).toBe("Email");
    expect(reminderChannelSchema.safeParse("SMS").success).toBe(false);
    expect(reminderChannelSchema.safeParse(null).success).toBe(false);
  });

  it("validates ISO date strings", () => {
    expect(iso8601DateSchema.parse("2026-06-06")).toBe("2026-06-06");
    expect(iso8601DateSchema.safeParse("2026-02-31").success).toBe(false);
    expect(iso8601DateSchema.safeParse("06/06/2026").success).toBe(false);
  });

  it("validates bounded text", () => {
    const schema = boundedTextSchema(2, 4);
    expect(schema.parse(" ok ")).toBe("ok");
    expect(schema.safeParse("x").success).toBe(false);
    expect(schema.safeParse("toolong").success).toBe(false);
  });

  it("validates reminder create payloads", () => {
    const payload = {
      documentId: "11111111-1111-4111-8111-111111111111",
      title: "Lease notice",
      description: "Send written notice.",
      fireOn: "2026-07-01",
      type: "Notice",
      channel: "Email",
    };
    expect(reminderCreateSchema.parse(payload).title).toBe("Lease notice");
    expect(reminderCreateSchema.safeParse({ ...payload, documentId: "nope" }).success).toBe(false);
    expect(reminderCreateSchema.safeParse({ ...payload, extra: true }).success).toBe(false);
  });

  it("validates reminder patch payloads", () => {
    expect(reminderPatchSchema.parse({ status: "approved" }).status).toBe("approved");
    expect(reminderPatchSchema.safeParse({ status: "done" }).success).toBe(false);
    expect(reminderPatchSchema.safeParse({ unexpected: "field" }).success).toBe(false);
  });

  it("validates notification preferences and defaults email to true", () => {
    expect(notificationPreferencesSchema.parse({}).email).toBe(true);
    expect(
      notificationPreferencesSchema.parse({
        email: false,
        version: 2,
        defaults: {
          renewal_offsets: ["30_days_before"],
          notice_offsets: ["7_days_before", "14_days_before"],
        },
      })
    ).toEqual({
      email: false,
      version: 2,
      defaults: {
        renewal_offsets: ["30_days_before"],
        notice_offsets: ["7_days_before", "14_days_before"],
      },
    });
  });

  it("rejects unknown notification preference keys", () => {
    expect(notificationPreferencesSchema.safeParse({ email: true, sms: true }).success).toBe(false);
    expect(
      notificationPreferencesSchema.safeParse({
        email: true,
        defaults: { renewal_offsets: ["30_days_before"], custom_offsets: ["1_day_before"] },
      }).success
    ).toBe(false);
  });
});
