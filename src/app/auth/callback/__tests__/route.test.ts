import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession, getUser },
  })),
}));

describe("/auth/callback", () => {
  beforeEach(() => {
    vi.resetModules();
    exchangeCodeForSession.mockReset();
    getUser.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    getUser.mockResolvedValue({ data: { user: null } });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("continues when the code exchange fails after the user is already authenticated", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("already exchanged") });
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { GET } = await import("../route");

    const response = await GET(
      new Request("https://clausly.test/auth/callback?code=abc&next=%2Fdashboard")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://clausly.test/dashboard");
  });

  it("ignores unsafe external next URLs", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://clausly.test/auth/callback?code=abc&next=https%3A%2F%2Fevil.test"
      )
    );

    expect(response.headers.get("location")).toBe("https://clausly.test/dashboard");
  });
});
