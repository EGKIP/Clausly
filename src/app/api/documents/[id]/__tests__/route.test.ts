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

import { DELETE, GET } from "../route";

describe("/api/documents/[id]", () => {
  beforeEach(() => resetSupabaseMock(userA));

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
