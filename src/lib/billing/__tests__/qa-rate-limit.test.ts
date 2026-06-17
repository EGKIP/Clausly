import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  resetSupabaseMock,
  seedUsageMetric,
  seedUser,
  userA,
} from "@/../tests/helpers/supabase";
import { canAskQuestion, getQaUsage } from "../qa-rate-limit";

vi.mock("server-only", () => ({}));

const now = new Date("2026-06-15T12:00:00.000Z");

describe("Q&A rate limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    resetSupabaseMock(userA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows free users with no usage and reports 25 remaining", async () => {
    seedUser(userA, { subscription_tier: "free" });

    await expect(canAskQuestion(createSupabaseClient(), userA.id)).resolves.toEqual({
      allowed: true,
      used: 0,
      limit: 25,
      remaining: 25,
      plan: "free",
      resetsAt: "2026-06-16T12:00:00.000Z",
    });
  });

  it("blocks free users after 25 Q&A calls in the rolling window", async () => {
    seedUser(userA, { subscription_tier: "free" });
    for (let index = 0; index < 25; index += 1) {
      seedUsageMetric(userA, {
        id: `usage-${index}`,
        job_type: index % 2 === 0 ? "qa_question" : "qa_portfolio",
        created_at: "2026-06-15T11:00:00.000Z",
      });
    }

    await expect(canAskQuestion(createSupabaseClient(), userA.id)).resolves.toMatchObject({
      allowed: false,
      used: 25,
      limit: 25,
      remaining: 0,
      plan: "free",
    });
  });

  it("allows pro users with 100 Q&A calls and reports 150 remaining", async () => {
    seedUser(userA, { subscription_tier: "pro" });
    for (let index = 0; index < 100; index += 1) {
      seedUsageMetric(userA, {
        id: `usage-${index}`,
        job_type: index % 2 === 0 ? "qa_question" : "qa_portfolio",
        created_at: "2026-06-15T11:00:00.000Z",
      });
    }

    await expect(getQaUsage(createSupabaseClient(), userA.id)).resolves.toMatchObject({
      used: 100,
      limit: 250,
      remaining: 150,
      plan: "pro",
    });
  });

  it("sets resetsAt to now plus 24 hours when no rows are in the window", async () => {
    seedUser(userA, { subscription_tier: "free" });

    const usage = await getQaUsage(createSupabaseClient(), userA.id);

    expect(usage.resetsAt).toBe("2026-06-16T12:00:00.000Z");
  });

  it("sets resetsAt to the oldest counted row plus 24 hours", async () => {
    seedUser(userA, { subscription_tier: "free" });
    seedUsageMetric(userA, {
      id: "old-outside-window",
      job_type: "qa_question",
      created_at: "2026-06-14T11:59:00.000Z",
    });
    seedUsageMetric(userA, {
      id: "oldest-inside-window",
      job_type: "qa_portfolio",
      created_at: "2026-06-14T12:01:00.000Z",
    });
    seedUsageMetric(userA, {
      id: "newer-inside-window",
      job_type: "qa_question",
      created_at: "2026-06-15T10:00:00.000Z",
    });
    seedUsageMetric(userA, {
      id: "suggest-inside-window",
      job_type: "qa_suggest",
      created_at: "2026-06-15T11:00:00.000Z",
    });
    seedUsageMetric(userA, {
      id: "non-qa-job",
      job_type: "analysis",
      created_at: "2026-06-14T12:00:30.000Z",
    });

    const usage = await getQaUsage(createSupabaseClient(), userA.id);

    expect(usage.used).toBe(3);
    expect(usage.resetsAt).toBe("2026-06-15T12:01:00.000Z");
  });
});
