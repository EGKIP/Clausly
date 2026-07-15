// @vitest-environment node
//
// Exercises the upload route, which runs in the Node.js server runtime, not
// a browser/DOM one. jsdom's File/Blob shim doesn't implement arrayBuffer()
// (unlike Node's real, undici-backed File/Blob), so this suite needs the
// real node environment to exercise the route's PDF-signature check.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  resetSupabaseMock,
  routeContext,
  seedUser,
  userA,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));
vi.mock("@/lib/ai/run-analysis", () => ({ runAnalysis: vi.fn(async () => ({ ok: true })) }));
vi.mock("server-only", () => ({}));

import { POST as uploadDocument } from "@/app/api/upload/route";
import { DELETE as deleteDocument } from "@/app/api/documents/[id]/route";

function uploadRequest(file: File, title = "Uploaded lease") {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("title", title);
  return {
    formData: async () => formData,
    headers: new Headers({
      "user-agent": "audit-test",
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
    }),
  } as Request;
}

describe("audit events integration", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("records upload and delete events without affecting the actions", async () => {
    seedUser(userA, { subscription_tier: "free" });
    const uploadResponse = await uploadDocument(
      uploadRequest(new File(["%PDF-1.7"], "audit.pdf", { type: "application/pdf" }), "Audit lease")
    );
    const uploadBody = await uploadResponse.json();

    expect(uploadResponse.status).toBe(201);
    expect(db().audit_events).toHaveLength(1);
    expect(db().audit_events[0]).toMatchObject({
      user_id: userA.id,
      action: "document.uploaded",
      resource_type: "document",
      resource_id: uploadBody.id,
    });
    expect(db().audit_events[0].metadata).toMatchObject({
      fileName: "audit.pdf",
      ipAddress: "203.0.113.10",
      userAgent: "audit-test",
    });

    const deleteResponse = await deleteDocument(
      new Request("http://localhost.test/api/documents/" + uploadBody.id, {
        method: "DELETE",
        headers: { "user-agent": "audit-test" },
      }),
      routeContext(uploadBody.id)
    );

    expect(deleteResponse.status).toBe(200);
    expect(db().documents).toHaveLength(0);
    expect(db().audit_events).toHaveLength(2);
    expect(db().audit_events[1]).toMatchObject({
      user_id: userA.id,
      action: "document.deleted",
      resource_type: "document",
      resource_id: uploadBody.id,
    });
  });
});
