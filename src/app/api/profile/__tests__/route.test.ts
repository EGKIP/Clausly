import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  jsonRequest,
  resetSupabaseMock,
  seedClause,
  seedDate,
  seedDocument,
  seedReminder,
  seedUser,
  setSupabaseEnv,
  setSupabaseUser,
  storageCalls,
  userA,
  userB,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));

import { DELETE, GET, PATCH } from "../route";

describe("/api/profile", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("returns the mock-mode payload when Supabase env is absent", async () => {
    setSupabaseEnv(false);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ mockMode: true, email: "demo@clausly.app" });
  });

  it("returns 400 for empty displayName", async () => {
    const response = await PATCH(jsonRequest({ displayName: "" }, { method: "PATCH" }));

    expect(response.status).toBe(400);
  });

  it("returns 400 for displayName over 80 characters", async () => {
    const response = await PATCH(jsonRequest({ displayName: "A".repeat(81) }, { method: "PATCH" }));

    expect(response.status).toBe(400);
  });

  it("updates the caller profile", async () => {
    seedUser(userA, { full_name: "Ada" });

    const response = await PATCH(jsonRequest({ displayName: "Ada Claus" }, { method: "PATCH" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.displayName).toBe("Ada Claus");
    expect(db().users[0].full_name).toBe("Ada Claus");
  });

  it("returns 401 when deleting without a session", async () => {
    setSupabaseUser(null);

    const response = await DELETE();

    expect(response.status).toBe(401);
  });

  it("deletes the caller account, files, and owned data", async () => {
    seedUser(userA, { full_name: "Ada" });
    const document = seedDocument(userA);
    seedClause(document.id, userA);
    seedDate(document.id, userA);
    seedReminder(document.id, userA);

    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(storageCalls().removed).toEqual([document.storage_path]);
    expect(db().users).toHaveLength(0);
    expect(db().documents).toHaveLength(0);
    expect(db().clauses).toHaveLength(0);
    expect(db().dates).toHaveLength(0);
    expect(db().reminders).toHaveLength(0);
  });

  it("does not delete another user account or portfolio", async () => {
    seedUser(userA, { full_name: "Ada" });
    seedUser(userB, { full_name: "Ben" });
    const documentA = seedDocument(userA);
    const documentB = seedDocument(userB);
    seedReminder(documentA.id, userA);
    seedReminder(documentB.id, userB);

    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(db().users).toEqual([expect.objectContaining({ id: userB.id })]);
    expect(db().documents).toEqual([expect.objectContaining({ id: documentB.id })]);
    expect(db().reminders).toEqual([expect.objectContaining({ user_id: userB.id })]);
    expect(storageCalls().removed).toEqual([documentA.storage_path]);
  });
});
