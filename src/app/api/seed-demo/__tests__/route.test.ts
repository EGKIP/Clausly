import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseClient, db, failNext, resetSupabaseMock, seedDocument, setSupabaseUser, userA } from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));

import { POST } from "../route";

describe("POST /api/seed-demo", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await POST();

    expect(response.status).toBe(401);
  });

  it("returns 409 when the portfolio is not empty", async () => {
    seedDocument(userA);

    const response = await POST();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "Portfolio not empty." });
  });

  it("seeds three demo documents with related rows for the caller", async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.seeded).toBe(3);
    expect(db().documents).toHaveLength(3);
    expect(db().clauses.length).toBeGreaterThanOrEqual(6);
    expect(db().dates).toHaveLength(3);
    expect(db().reminders).toHaveLength(3);
    expect(db().documents.every((row) => row.user_id === userA.id)).toBe(true);
    expect(db().clauses.every((row) => row.user_id === userA.id)).toBe(true);
    expect(db().dates.every((row) => row.user_id === userA.id)).toBe(true);
    expect(db().reminders.every((row) => row.user_id === userA.id)).toBe(true);
    expect(db().documents.every((row) => row.tags.includes("Demo"))).toBe(true);
  });

  it("rolls back inserted documents when a clause insert fails", async () => {
    failNext("insert", "clauses", "Clause insert failed.");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Clause insert failed.");
    expect(db().documents).toHaveLength(0);
    expect(db().clauses).toHaveLength(0);
    expect(db().dates).toHaveLength(0);
    expect(db().reminders).toHaveLength(0);
  });
});
