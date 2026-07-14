import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession },
  })),
}));

describe("/auth/callback", () => {
  beforeEach(() => {
    vi.resetModules();
    exchangeCodeForSession.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  });

  it("exchanges the OAuth code and redirects to the next path", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const { GET } = await import("../route");

    const response = await GET(
      new Request("https://clausly.test/auth/callback?code=abc&next=%2Fdashboard%2Fwelcome")
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://clausly.test/dashboard/welcome");
  });

  it("redirects to login when the OAuth code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("invalid code") });
    const { GET } = await import("../route");

    const response = await GET(new Request("https://clausly.test/auth/callback?code=bad"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://clausly.test/login?error=oauth_callback_failed"
    );
  });
});
