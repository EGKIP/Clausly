import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createServiceSupabaseClientMock,
  db,
  resetSupabaseMock,
  seedClause,
  seedDate,
  seedDocument,
  seedDocumentShare,
  seedReminder,
  setSupabaseUser,
  userA,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/notifications/supabase-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/notifications/supabase-service")>(
    "@/lib/notifications/supabase-service"
  );
  return {
    ...actual,
    createServiceSupabaseClient: () => createServiceSupabaseClientMock(),
  };
});
vi.mock("server-only", () => ({}));

import { GET } from "../route";

function tokenContext(token: string) {
  return { params: Promise.resolve({ token }) };
}

describe("GET /api/shares/[token]", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  });

  it("returns 503 when the service client is not configured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await GET(
      new Request("http://localhost.test/api/shares/token"),
      tokenContext("token")
    );

    expect(response.status).toBe(503);
  });

  it("returns 404 for a missing token without requiring a session", async () => {
    setSupabaseUser(null);

    const response = await GET(
      new Request("http://localhost.test/api/shares/missing"),
      tokenContext("missing")
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 for revoked or expired shares", async () => {
    const document = seedDocument(userA);
    seedDocumentShare(document.id, userA, { token: "revoked", revoked_at: "2026-06-01T00:00:00.000Z" });
    seedDocumentShare(document.id, userA, { token: "expired", expires_at: "2020-01-01T00:00:00.000Z" });

    const revoked = await GET(new Request("http://localhost.test/api/shares/revoked"), tokenContext("revoked"));
    const expired = await GET(new Request("http://localhost.test/api/shares/expired"), tokenContext("expired"));

    expect(revoked.status).toBe(404);
    expect(expired.status).toBe(404);
  });

  it("returns a public digest without source quotes and increments views best-effort", async () => {
    const document = seedDocument(userA, {
      title: "Shared Lease",
      summary: "This lease renews annually.",
    });
    const share = seedDocumentShare(document.id, userA, { token: "public-token", view_count: 3 });
    seedClause(document.id, userA, {
      title: "Renewal",
      source_quote: "This verbatim text should stay private.",
      plain_english: "The lease renews unless notice is sent.",
      why_it_matters: "Missing notice can extend the lease.",
    });
    seedDate(document.id, userA, { label: "Notice deadline" });
    seedReminder(document.id, userA, { title: "Send notice", status: "approved" });

    setSupabaseUser(null);
    const response = await GET(
      new Request("http://localhost.test/api/shares/public-token"),
      tokenContext("public-token")
    );
    const payload = await response.json();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      document: {
        title: "Shared Lease",
        dates: [expect.objectContaining({ label: "Notice deadline" })],
      },
      summary: "This lease renews annually.",
      clauses: [
        expect.objectContaining({
          title: "Renewal",
          plainEnglish: "The lease renews unless notice is sent.",
          whyItMatters: "Missing notice can extend the lease.",
        }),
      ],
      recommendedActions: [expect.objectContaining({ title: "Send notice" })],
    });
    expect(JSON.stringify(payload)).not.toContain("verbatim text");
    expect(db().document_shares.find((row) => row.id === share.id)?.view_count).toBe(4);
  });
});
