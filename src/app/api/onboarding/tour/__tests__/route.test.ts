import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  failNext,
  resetSupabaseMock,
  seedUser,
  setSupabaseEnv,
  setSupabaseUser,
  userA,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));

import { GET, POST } from "../route";

describe("/api/onboarding/tour", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("GET returns mock incomplete state when Supabase is not configured", async () => {
    setSupabaseEnv(false);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ completedAt: null });
  });

  it("POST succeeds in mock mode without persistence", async () => {
    setSupabaseEnv(false);

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ completedAt: null, skipped: true });
  });

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const getResponse = await GET();
    const postResponse = await POST();

    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
  });

  it("GET returns the persisted tour state", async () => {
    seedUser(userA, { onboarding_tour_completed_at: "2026-06-18T10:00:00.000Z" });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ completedAt: "2026-06-18T10:00:00.000Z" });
  });

  it("POST marks the tour complete", async () => {
    seedUser(userA);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.completedAt).toBeTruthy();
    expect(db().users[0].onboarding_tour_completed_at).toBe(body.completedAt);
  });

  it("returns 500 when persistence fails", async () => {
    seedUser(userA);
    failNext("update", "users", "Tour update failed.");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Tour update failed.");
  });
});
