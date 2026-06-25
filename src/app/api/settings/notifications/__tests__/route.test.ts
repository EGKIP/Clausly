import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  db,
  jsonRequest,
  resetSupabaseMock,
  seedUser,
  setSupabaseEnv,
  setSupabaseUser,
  userA,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => (await import("@/../tests/helpers/supabase")).createSupabaseClient(),
}));
vi.mock("server-only", () => ({}));

import { GET, PATCH } from "../route";

describe("/api/settings/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSupabaseMock(userA);
    seedUser(userA, { subscription_tier: "pro" });
  });

  it("returns defaults in mock mode", async () => {
    setSupabaseEnv(false);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      preferences: { email: true, reminders: true, weeklyDigest: true },
      mockMode: true,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns current preferences for the signed-in user", async () => {
    db().users[0].notification_preferences = { email: false, reminders: true, weekly_digest: false };

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      preferences: { email: false, reminders: true, weeklyDigest: false },
      plan: "pro",
      mockMode: false,
    });
  });

  it("updates preferences for a Pro user", async () => {
    db().users[0].notification_preferences = { email: true, reminders: true, weekly_digest: true };

    const response = await PATCH(jsonRequest({ reminders: false, weeklyDigest: false }, { method: "PATCH" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.preferences).toEqual({ email: true, reminders: false, weeklyDigest: false });
    expect(db().users[0].notification_preferences).toEqual({
      email: true,
      reminders: false,
      weekly_digest: false,
    });
  });

  it("rejects invalid body values", async () => {
    const response = await PATCH(jsonRequest({ email: "nope" }, { method: "PATCH" }));

    expect(response.status).toBe(400);
  });

  it("rejects unknown keys", async () => {
    const response = await PATCH(jsonRequest({ sms: true }, { method: "PATCH" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.issues[0].message).toContain("Unrecognized key");
  });

  it("allows free users to opt out of weekly digest but rejects opting in", async () => {
    db().users[0].subscription_tier = "free";
    db().users[0].notification_preferences = { email: true, reminders: true, weekly_digest: true };

    const optOut = await PATCH(jsonRequest({ weeklyDigest: false }, { method: "PATCH" }));
    const optIn = await PATCH(jsonRequest({ weeklyDigest: true }, { method: "PATCH" }));
    const optInPayload = await optIn.json();

    expect(optOut.status).toBe(200);
    expect(optIn.status).toBe(403);
    expect(optInPayload).toMatchObject({ code: "PLAN_REQUIRED" });
  });
});
