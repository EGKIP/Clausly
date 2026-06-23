import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  resetSupabaseMock,
  seedDocument,
  seedDocumentExport,
  seedUser,
  userA,
} from "@/../tests/helpers/supabase";
import { canExport, getExportUsage } from "../limits";

vi.mock("server-only", () => ({}));

const now = new Date("2026-06-23T12:00:00.000Z");

describe("document export limits", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    resetSupabaseMock(userA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows free users with no exports and reports five remaining", async () => {
    seedUser(userA, { subscription_tier: "free" });

    await expect(canExport(createSupabaseClient(), userA.id)).resolves.toEqual({
      allowed: true,
      used: 0,
      limit: 5,
      remaining: 5,
      plan: "free",
      resetsAt: "2026-07-23T12:00:00.000Z",
    });
  });

  it("blocks free users after five exports in the rolling 30-day window", async () => {
    seedUser(userA, { subscription_tier: "free" });
    const document = seedDocument(userA);
    for (let index = 0; index < 5; index += 1) {
      seedDocumentExport(document.id, userA, {
        id: `export-${index}`,
        created_at: "2026-06-23T11:00:00.000Z",
      });
    }

    await expect(canExport(createSupabaseClient(), userA.id)).resolves.toMatchObject({
      allowed: false,
      used: 5,
      limit: 5,
      remaining: 0,
      plan: "free",
    });
  });

  it("ignores exports outside the rolling 30-day window and sets resetsAt from the oldest counted row", async () => {
    seedUser(userA, { subscription_tier: "free" });
    const document = seedDocument(userA);
    seedDocumentExport(document.id, userA, {
      id: "outside-window",
      created_at: "2026-05-24T11:59:00.000Z",
    });
    seedDocumentExport(document.id, userA, {
      id: "oldest-inside-window",
      created_at: "2026-05-24T12:01:00.000Z",
    });
    seedDocumentExport(document.id, userA, {
      id: "newer-inside-window",
      created_at: "2026-06-23T11:00:00.000Z",
    });

    const usage = await getExportUsage(createSupabaseClient(), userA.id);

    expect(usage).toMatchObject({
      used: 2,
      remaining: 3,
      resetsAt: "2026-06-23T12:01:00.000Z",
    });
  });

  it("allows pro users regardless of export count", async () => {
    seedUser(userA, { subscription_tier: "pro" });
    const document = seedDocument(userA);
    for (let index = 0; index < 10; index += 1) {
      seedDocumentExport(document.id, userA, {
        id: `export-${index}`,
        created_at: "2026-06-23T11:00:00.000Z",
      });
    }

    await expect(canExport(createSupabaseClient(), userA.id)).resolves.toMatchObject({
      allowed: true,
      used: 0,
      limit: Infinity,
      remaining: Infinity,
      plan: "pro",
    });
  });
});
