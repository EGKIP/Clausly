import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  resetSupabaseMock,
  seedUsageMetric,
  seedUser,
  setSupabaseUser,
  userA,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));

import { GET } from "../route";

describe("GET /api/ask/usage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
    resetSupabaseMock(userA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns current Q&A usage for the authenticated user", async () => {
    seedUser(userA, { subscription_tier: "free" });
    seedUsageMetric(userA, {
      id: "qa-1",
      job_type: "qa_question",
      created_at: "2026-06-15T10:00:00.000Z",
    });
    seedUsageMetric(userA, {
      id: "qa-2",
      job_type: "qa_portfolio",
      created_at: "2026-06-15T11:00:00.000Z",
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      used: 2,
      limit: 25,
      remaining: 23,
      plan: "free",
      resetsAt: "2026-06-16T10:00:00.000Z",
    });
  });
});
