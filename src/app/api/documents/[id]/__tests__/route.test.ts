import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  resetSupabaseMock,
  routeContext,
  seedClause,
  seedDate,
  seedDocument,
  seedReminder,
  setSupabaseUser,
  storageCalls,
  userA,
  userB,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));
vi.mock("server-only", () => ({}));

import { DELETE, GET, PATCH } from "../route";

function patchRequest(body: unknown) {
  return new Request("http://localhost.test", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/documents/[id]", () => {
  beforeEach(() => resetSupabaseMock(userA));

  describe("PATCH", () => {
    it("renames an owned document and returns the updated document", async () => {
      const document = seedDocument(userA, { title: "lease" });

      const response = await PATCH(patchRequest({ title: "Apartment lease" }), routeContext(document.id));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.document).toMatchObject({ id: document.id, title: "Apartment lease" });
      expect(db().documents[0].title).toBe("Apartment lease");
    });

    it("rejects an empty title", async () => {
      const document = seedDocument(userA, { title: "Original" });

      const response = await PATCH(patchRequest({ title: "   " }), routeContext(document.id));

      expect(response.status).toBe(400);
      expect(db().documents[0].title).toBe("Original");
    });

    it("rejects titles over 200 characters", async () => {
      const document = seedDocument(userA, { title: "Original" });

      const response = await PATCH(patchRequest({ title: "x".repeat(201) }), routeContext(document.id));

      expect(response.status).toBe(400);
      expect(db().documents[0].title).toBe("Original");
    });

    it("does not rename cross-tenant documents", async () => {
      const other = seedDocument(userB, { title: "Their lease" });

      const response = await PATCH(patchRequest({ title: "Hijacked" }), routeContext(other.id));

      expect(response.status).toBe(404);
      expect(db().documents[0].title).toBe("Their lease");
    });

    it("returns 401 when unauthenticated", async () => {
      setSupabaseUser(null);

      const response = await PATCH(patchRequest({ title: "New name" }), routeContext("missing"));

      expect(response.status).toBe(401);
    });
  });

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await GET(new Request("http://localhost.test"), routeContext("missing"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when the document belongs to another user", async () => {
    const other = seedDocument(userB);

    const response = await GET(new Request("http://localhost.test"), routeContext(other.id));

    expect(response.status).toBe(404);
  });

  it("deletes an owned document and cascades related rows", async () => {
    const document = seedDocument(userA);
    seedClause(document.id, userA);
    seedDate(document.id, userA);
    seedReminder(document.id, userA);

    const response = await DELETE(new Request("http://localhost.test", { method: "DELETE" }), routeContext(document.id));

    expect(response.status).toBe(200);
    expect(db().documents).toHaveLength(0);
    expect(db().clauses).toHaveLength(0);
    expect(db().dates).toHaveLength(0);
    expect(db().reminders).toHaveLength(0);
    expect(storageCalls().removed).toEqual([document.storage_path]);
  });

  it("returns 403 when the storage path does not belong to the user", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const document = seedDocument(userA, { storage_path: userB.id + "/foreign/doc.pdf" });

    const response = await DELETE(new Request("http://localhost.test", { method: "DELETE" }), routeContext(document.id));

    expect(response.status).toBe(403);
    expect(storageCalls().removed).toEqual([]);
    expect(db().documents).toHaveLength(1);
    warn.mockRestore();
  });
});
