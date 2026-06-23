import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../route";
import { sendWeeklyDigests } from "@/lib/notifications/weekly-digest";

vi.mock("@/lib/notifications/weekly-digest", () => ({
  sendWeeklyDigests: vi.fn(async () => ({ processed: 1, sent: 1, skipped: 0, failed: 0 })),
}));

describe("/api/notifications/weekly-digest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    process.env.CLAUSLY_DISPATCH_SECRET = "dispatch-secret";
    delete process.env.CRON_SECRET;
  });

  it("rejects unauthorized requests", async () => {
    const response = await POST(new Request("https://clausly.test/api/notifications/weekly-digest", { method: "POST" }));

    expect(response.status).toBe(401);
    expect(sendWeeklyDigests).not.toHaveBeenCalled();
  });

  it("returns 503 when service role env is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await POST(new Request("https://clausly.test/api/notifications/weekly-digest", {
      method: "POST",
      headers: { Authorization: "Bearer dispatch-secret" },
    }));

    await expect(response.json()).resolves.toEqual({ error: "Supabase service role is not configured." });
    expect(response.status).toBe(503);
    expect(sendWeeklyDigests).not.toHaveBeenCalled();
  });

  it("runs weekly digest dispatch for authorized cron requests", async () => {
    process.env.CRON_SECRET = "cron-secret";

    const response = await GET(new Request("https://clausly.test/api/notifications/weekly-digest", {
      method: "GET",
      headers: { Authorization: "Bearer cron-secret" },
    }));

    await expect(response.json()).resolves.toEqual({ processed: 1, sent: 1, skipped: 0, failed: 0 });
    expect(response.status).toBe(200);
    expect(sendWeeklyDigests).toHaveBeenCalledTimes(1);
  });
});
