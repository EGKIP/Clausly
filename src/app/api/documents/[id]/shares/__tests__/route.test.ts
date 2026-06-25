import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  db,
  jsonRequest,
  resetSupabaseMock,
  routeContext,
  seedDocument,
  seedDocumentShare,
  seedUser,
  setSupabaseEnv,
  setSupabaseUser,
  userA,
  userB,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => (await import("@/../tests/helpers/supabase")).createSupabaseClient(),
}));
vi.mock("server-only", () => ({}));

import { DELETE } from "../[shareId]/route";
import { GET, POST } from "../route";

function shareRouteContext(documentId: string, shareId: string) {
  return { params: Promise.resolve({ id: documentId, shareId }) };
}

describe("/api/documents/[id]/shares owner routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSupabaseMock(userA);
    seedUser(userA, { subscription_tier: "pro" });
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.clausly.test";
  });

  it("returns 503 when Supabase is not configured", async () => {
    setSupabaseEnv(false);

    const response = await GET(
      new Request("http://localhost.test/api/documents/doc/shares"),
      routeContext("doc")
    );

    expect(response.status).toBe(503);
  });

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await GET(
      new Request("http://localhost.test/api/documents/doc/shares"),
      routeContext("doc")
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when the document is not owned by the caller", async () => {
    const otherDocument = seedDocument(userB);

    const response = await GET(
      new Request(`http://localhost.test/api/documents/${otherDocument.id}/shares`),
      routeContext(otherDocument.id)
    );

    expect(response.status).toBe(404);
  });

  it("returns 403 when a free user tries to create a share", async () => {
    db().users[0].subscription_tier = "free";
    const document = seedDocument(userA);

    const response = await POST(
      jsonRequest({ expiresInDays: 7 }, {
        method: "POST",
      }),
      routeContext(document.id)
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      code: "PLAN_REQUIRED",
      plan: "free",
    });
  });

  it("validates create-share settings", async () => {
    const document = seedDocument(userA);

    const response = await POST(
      jsonRequest({ expiresInDays: 999 }, { method: "POST" }),
      routeContext(document.id)
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.issues[0].path).toBe("expiresInDays");
  });

  it("creates a Pro share and returns a public URL without logging token state elsewhere", async () => {
    const document = seedDocument(userA);

    const response = await POST(
      jsonRequest({ expiresInDays: 30 }, { method: "POST" }),
      routeContext(document.id)
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({
      id: expect.any(String),
      token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      url: expect.stringMatching(/^https:\/\/app\.clausly\.test\/share\/[A-Za-z0-9_-]{43}$/),
      expiresAt: expect.any(String),
    });
    expect(db().document_shares).toEqual([
      expect.objectContaining({
        id: payload.id,
        user_id: userA.id,
        document_id: document.id,
        token: payload.token,
      }),
    ]);
  });

  it("lists owned shares for a document", async () => {
    const document = seedDocument(userA);
    seedDocumentShare(document.id, userA, { id: "share-1" });
    seedDocumentShare(document.id, userB, { id: "share-2" });

    const response = await GET(
      new Request(`http://localhost.test/api/documents/${document.id}/shares`),
      routeContext(document.id)
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.shares).toEqual([
      expect.objectContaining({ id: "share-1", documentId: document.id }),
    ]);
  });

  it("revokes only a share scoped to the route document and owner", async () => {
    const document = seedDocument(userA);
    const share = seedDocumentShare(document.id, userA, { id: "share-1" });
    const otherDocument = seedDocument(userA, { id: "other-doc" });
    const otherShare = seedDocumentShare(otherDocument.id, userA, { id: "share-2" });

    const response = await DELETE(
      new Request(`http://localhost.test/api/documents/${document.id}/shares/${share.id}`, { method: "DELETE" }),
      shareRouteContext(document.id, share.id)
    );
    const wrongDocumentResponse = await DELETE(
      new Request(`http://localhost.test/api/documents/${document.id}/shares/${otherShare.id}`, { method: "DELETE" }),
      shareRouteContext(document.id, otherShare.id)
    );

    expect(response.status).toBe(200);
    expect(wrongDocumentResponse.status).toBe(404);
    expect(db().document_shares.find((row) => row.id === share.id)?.revoked_at).toEqual(expect.any(String));
    expect(db().document_shares.find((row) => row.id === otherShare.id)?.revoked_at).toBeNull();
  });
});
