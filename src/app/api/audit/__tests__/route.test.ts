import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  resetSupabaseMock,
  seedAuditEvent,
  seedUser,
  setSupabaseUser,
  userA,
  userB,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));
vi.mock("server-only", () => ({}));

import { GET } from "../route";

describe("GET /api/audit", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await GET(new Request("http://localhost.test/api/audit"));

    expect(response.status).toBe(401);
  });

  it("returns 403 for free users", async () => {
    seedUser(userA, { subscription_tier: "free" });

    const response = await GET(new Request("http://localhost.test/api/audit"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ code: "PLAN_REQUIRED", plan: "free" });
  });

  it("returns owner-scoped activity newest first with a cursor", async () => {
    seedUser(userA, { subscription_tier: "pro" });
    seedAuditEvent(userA, {
      id: "event-old",
      action: "document.deleted",
      resource_type: "document",
      created_at: "2026-06-01T00:00:00.000Z",
    });
    seedAuditEvent(userA, {
      id: "event-new",
      action: "document.uploaded",
      resource_type: "document",
      created_at: "2026-06-02T00:00:00.000Z",
    });
    seedAuditEvent(userB, {
      id: "event-other",
      action: "document.uploaded",
      resource_type: "document",
      created_at: "2026-06-03T00:00:00.000Z",
    });

    const response = await GET(new Request("http://localhost.test/api/audit?limit=1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      id: "event-new",
      action: "document.uploaded",
      resourceType: "document",
    });
    expect(body.nextCursor).toEqual(expect.any(String));

    const nextResponse = await GET(new Request(`http://localhost.test/api/audit?limit=1&cursor=${body.nextCursor}`));
    const nextBody = await nextResponse.json();

    expect(nextResponse.status).toBe(200);
    expect(nextBody.events).toHaveLength(1);
    expect(nextBody.events[0].id).toBe("event-old");
    expect(nextBody.nextCursor).toBeNull();
  });

  it("returns 400 for invalid cursors", async () => {
    seedUser(userA, { subscription_tier: "pro" });

    const response = await GET(new Request("http://localhost.test/api/audit?cursor=nope"));

    expect(response.status).toBe(400);
  });
});
