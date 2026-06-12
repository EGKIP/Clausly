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
    await expect(response.json()).resolves.toMatchObject({
      mockMode: true,
      email: "demo@clausly.app",
      plan: "free",
      usage: { documents: { current: 0, limit: 5 } },
    });
  });

  it("returns plan and document usage in the profile payload", async () => {
    seedUser(userA, { subscription_tier: "free" });
    seedDocument(userA, { id: "document-1" });
    seedDocument(userA, { id: "document-2" });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      plan: "free",
      usage: { documents: { current: 2, limit: 5 } },
    });
  });

  it("serializes pro unlimited document usage as null limit", async () => {
    seedUser(userA, { subscription_tier: "pro" });
    for (let index = 0; index < 7; index += 1) {
      seedDocument(userA, { id: `document-${index}` });
    }

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      plan: "pro",
      usage: { documents: { current: 7, limit: null } },
    });
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

  it("accepts partial notification preference updates and persists them", async () => {
    seedUser(userA, { notification_preferences: { email: true, version: 3 } });

    const response = await PATCH(
      jsonRequest({ notification_preferences: { defaults: { renewal_offsets: ["30_days_before"] } } }, { method: "PATCH" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.notificationPreferences).toEqual({
      email: true,
      version: 3,
      defaults: { renewal_offsets: ["30_days_before"] },
    });
    expect(db().users[0].notification_preferences).toEqual(body.notificationPreferences);
  });

  it("returns 400 for unknown notification preference keys", async () => {
    seedUser(userA);

    const response = await PATCH(
      jsonRequest({ notification_preferences: { email: true, sms: true } }, { method: "PATCH" })
    );

    expect(response.status).toBe(400);
  });

  it("bumps notification preference version when the email toggle changes", async () => {
    seedUser(userA, { notification_preferences: { email: true, version: 4 } });

    const response = await PATCH(
      jsonRequest({ notification_preferences: { email: false } }, { method: "PATCH" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.notificationPreferences).toEqual({ email: false, version: 5 });
    expect(db().users[0].notification_preferences).toEqual({ email: false, version: 5 });
  });

  it("starts notification preference version at 1 when toggling email from unversioned settings", async () => {
    seedUser(userA, { notification_preferences: { email: true } });

    const response = await PATCH(
      jsonRequest({ notification_preferences: { email: false } }, { method: "PATCH" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.notificationPreferences.version).toBe(1);
  });

  it("ignores client-supplied notification preference version", async () => {
    seedUser(userA, { notification_preferences: { email: true, version: 4 } });

    const response = await PATCH(
      jsonRequest({ notification_preferences: { version: 9999 } }, { method: "PATCH" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.notificationPreferences.version).toBe(4);
    expect(db().users[0].notification_preferences.version).toBe(4);
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
