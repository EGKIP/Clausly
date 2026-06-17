import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  failNext,
  resetSupabaseMock,
  seedUser,
  userA,
} from "@/../tests/helpers/supabase";
import { getTourState, markTourComplete } from "../onboarding-tour";

vi.mock("server-only", () => ({}));

describe("onboarding tour helpers", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("returns the persisted completion timestamp", async () => {
    seedUser(userA, { onboarding_tour_completed_at: "2026-06-18T10:00:00.000Z" });

    const state = await getTourState(createSupabaseClient(), userA.id);

    expect(state).toEqual({ completedAt: "2026-06-18T10:00:00.000Z" });
  });

  it("defaults to incomplete when the user row is missing", async () => {
    const state = await getTourState(createSupabaseClient(), userA.id);

    expect(state).toEqual({ completedAt: null });
  });

  it("marks the tour complete for the current user", async () => {
    seedUser(userA);

    const state = await markTourComplete(createSupabaseClient(), userA.id);

    expect(state.completedAt).toBeTruthy();
    expect(db().users[0].onboarding_tour_completed_at).toBe(state.completedAt);
  });

  it("throws when the update fails", async () => {
    seedUser(userA);
    failNext("update", "users", "Could not update user.");

    await expect(markTourComplete(createSupabaseClient(), userA.id)).rejects.toThrow("Could not update user.");
  });
});
