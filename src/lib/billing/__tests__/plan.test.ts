import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  resetSupabaseMock,
  seedDocument,
  seedUser,
  userA,
} from "@/../tests/helpers/supabase";
import { canAccessInsights, canUploadDocument, getUserPlan } from "../plan";

vi.mock("server-only", () => ({}));

describe("billing plan resolution", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("defaults to free when the user row is missing", async () => {
    await expect(getUserPlan(createSupabaseClient(), userA.id)).resolves.toBe("free");
  });

  it("respects the free document limit", async () => {
    seedUser(userA, { subscription_tier: "free" });
    for (let index = 0; index < 5; index += 1) {
      seedDocument(userA, { id: `document-${index}` });
    }

    await expect(canUploadDocument(createSupabaseClient(), userA.id)).resolves.toEqual({
      allowed: false,
      current: 5,
      limit: 5,
      plan: "free",
    });
  });

  it("allows pro users beyond the free document limit", async () => {
    seedUser(userA, { subscription_tier: "pro" });
    for (let index = 0; index < 100; index += 1) {
      seedDocument(userA, { id: `document-${index}` });
    }

    const result = await canUploadDocument(createSupabaseClient(), userA.id);

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(100);
    expect(result.limit).toBe(Infinity);
    expect(result.plan).toBe("pro");
  });

  it("gates insights by plan", async () => {
    seedUser(userA, { subscription_tier: "free" });
    await expect(canAccessInsights(createSupabaseClient(), userA.id)).resolves.toEqual({
      allowed: false,
      plan: "free",
    });

    resetSupabaseMock(userA);
    seedUser(userA, { subscription_tier: "pro" });
    await expect(canAccessInsights(createSupabaseClient(), userA.id)).resolves.toEqual({
      allowed: true,
      plan: "pro",
    });
  });
});
