import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  failNext,
  resetSupabaseMock,
  setSupabaseEnv,
  userA,
} from "@/../tests/helpers/supabase";
import { AUDIT_ACTIONS } from "../actions";
import { logAuditEvent, sanitizeMetadata } from "../log";

vi.mock("server-only", () => ({}));

type AuditClient = Parameters<typeof logAuditEvent>[0];
const auditClient = () => createSupabaseClient() as unknown as AuditClient;

describe("audit logging", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("defines the canonical audit action vocabulary", () => {
    expect(Object.values(AUDIT_ACTIONS)).toEqual([
      "document.uploaded",
      "document.deleted",
      "reminder.approved",
      "reminder.dismissed",
      "reminder.fired",
      "conversation.created",
      "subscription.upgraded",
      "subscription.cancelled",
      "share.created",
      "share.revoked",
      "export.created",
      "account.deleted",
    ]);
  });

  it("inserts an audit row for a state-changing action", async () => {
    await logAuditEvent(auditClient(), {
      userId: userA.id,
      action: AUDIT_ACTIONS.DOCUMENT_UPLOADED,
      resourceType: "document",
      resourceId: "00000000-0000-4000-8000-000000000123",
      metadata: { title: "Lease" },
    });

    expect(db().audit_events).toEqual([
      expect.objectContaining({
        user_id: userA.id,
        action: "document.uploaded",
        resource_type: "document",
        resource_id: "00000000-0000-4000-8000-000000000123",
        metadata: { title: "Lease" },
      }),
    ]);
  });

  it("does not throw when the audit insert fails", async () => {
    failNext("insert", "audit_events", "Audit table unavailable.");

    await expect(logAuditEvent(auditClient(), {
      userId: userA.id,
      action: AUDIT_ACTIONS.DOCUMENT_DELETED,
      resourceType: "document",
    })).resolves.toBeUndefined();

    expect(console.warn).toHaveBeenCalledWith("Audit event insert failed.", expect.objectContaining({
      action: "document.deleted",
      message: "Audit table unavailable.",
    }));
  });

  it("strips sensitive metadata keys recursively", () => {
    expect(sanitizeMetadata({
      title: "Lease",
      token: "secret-token",
      nested: {
        password: "nope",
        safe: true,
      },
      array: [{ key: "private", value: "public" }],
    })).toEqual({
      title: "Lease",
      nested: { safe: true },
      array: [{ value: "public" }],
    });
  });

  it("truncates metadata below the storage budget", () => {
    const metadata = sanitizeMetadata({ text: "x".repeat(3000) });

    expect(JSON.stringify(metadata).length).toBeLessThan(2000);
    expect(metadata).toEqual(expect.objectContaining({
      truncated: true,
      originalSize: expect.any(Number),
    }));
  });

  it("coerces non-plain metadata to an empty object", () => {
    expect(sanitizeMetadata(["not", "plain"])).toEqual({});
    expect(sanitizeMetadata(null)).toEqual({});
  });

  it("skips inserts in mock mode", async () => {
    setSupabaseEnv(false);

    await logAuditEvent(auditClient(), {
      userId: userA.id,
      action: AUDIT_ACTIONS.EXPORT_CREATED,
      resourceType: "document",
    });

    expect(db().audit_events).toEqual([]);
  });
});
