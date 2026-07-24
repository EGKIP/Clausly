import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  after: vi.fn((callback: () => unknown) => {
    void callback();
  }),
  sendWelcomeEmailOnceForUser: vi.fn(),
  createServiceSupabaseClient: vi.fn(() => ({ service: true })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession, getUser: mocks.getUser },
  })),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: mocks.createServiceSupabaseClient,
}));
vi.mock("@/lib/notifications/welcome", () => ({
  sendWelcomeEmailOnceForUser: mocks.sendWelcomeEmailOnceForUser,
}));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: mocks.after };
});

describe("/auth/callback", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.exchangeCodeForSession.mockReset();
    mocks.getUser.mockReset();
    mocks.after.mockClear();
    mocks.sendWelcomeEmailOnceForUser.mockReset();
    mocks.createServiceSupabaseClient.mockClear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.sendWelcomeEmailOnceForUser.mockResolvedValue({ sent: true });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exchanges the OAuth code and redirects to the next path", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { GET } = await import("../route");

    const response = await GET(
      new Request("https://clausly.test/auth/callback?code=abc&next=%2Fdashboard%2Fwelcome")
    );

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://clausly.test/dashboard/welcome");
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(mocks.sendWelcomeEmailOnceForUser).toHaveBeenCalledWith({
      supabase: { service: true },
      userId: "user-1",
    });
  });

  it("redirects to login when the OAuth code exchange fails", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error("invalid code") });
    const { GET } = await import("../route");

    const response = await GET(new Request("https://clausly.test/auth/callback?code=bad"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://clausly.test/login?error=oauth_callback_failed"
    );
    expect(mocks.sendWelcomeEmailOnceForUser).not.toHaveBeenCalled();
  });

  it("continues when the code exchange fails after the user is already authenticated", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error("already exchanged") });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { GET } = await import("../route");

    const response = await GET(
      new Request("https://clausly.test/auth/callback?code=abc&next=%2Fdashboard")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://clausly.test/dashboard");
    expect(mocks.sendWelcomeEmailOnceForUser).toHaveBeenCalledWith({
      supabase: { service: true },
      userId: "user-1",
    });
  });

  it("ignores unsafe external next URLs", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://clausly.test/auth/callback?code=abc&next=https%3A%2F%2Fevil.test"
      )
    );

    expect(response.headers.get("location")).toBe("https://clausly.test/dashboard");
  });

  it("does not schedule welcome email when the service role env is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { GET } = await import("../route");

    const response = await GET(new Request("https://clausly.test/auth/callback?code=abc"));

    expect(response.status).toBe(307);
    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.sendWelcomeEmailOnceForUser).not.toHaveBeenCalled();
  });
});
