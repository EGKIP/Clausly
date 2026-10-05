import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headerValue: null as string | null,
  cookieGetAll: vi.fn(() => [] as { name: string; value: string }[]),
  ssrClient: vi.fn(),
  bearerClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => (name.toLowerCase() === "authorization" ? mocks.headerValue : null) }),
  cookies: async () => ({ getAll: mocks.cookieGetAll, set: vi.fn() }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => {
    mocks.ssrClient(...args);
    return { kind: "ssr" };
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => {
    mocks.bearerClient(...args);
    return { kind: "bearer", auth: { getUser: mocks.getUser } };
  },
}));

import { createClient } from "../server";

describe("createClient (server)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headerValue = null;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  });

  it("uses cookie auth when there is no Authorization header", async () => {
    const client = await createClient();

    expect(client).toEqual({ kind: "ssr" });
    expect(mocks.ssrClient).toHaveBeenCalledOnce();
    expect(mocks.bearerClient).not.toHaveBeenCalled();
  });

  it("uses cookie auth for a non-Bearer Authorization header", async () => {
    mocks.headerValue = "Basic dXNlcjpwYXNz";

    await createClient();

    expect(mocks.ssrClient).toHaveBeenCalledOnce();
    expect(mocks.bearerClient).not.toHaveBeenCalled();
  });

  it("acts as the bearer-token user with the anon key and no stored session", async () => {
    mocks.headerValue = "Bearer user-jwt";

    await createClient();

    expect(mocks.ssrClient).not.toHaveBeenCalled();
    expect(mocks.bearerClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      expect.objectContaining({
        global: { headers: { Authorization: "Bearer user-jwt" } },
        auth: expect.objectContaining({ persistSession: false, autoRefreshToken: false }),
      })
    );
  });

  it("validates the caller's token when getUser() is called with no argument", async () => {
    mocks.headerValue = "bearer user-jwt";
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const client = await createClient();
    await client.auth.getUser();

    expect(mocks.getUser).toHaveBeenCalledWith("user-jwt");
  });

  it("never falls back to cookies when a bearer token is invalid", async () => {
    mocks.headerValue = "Bearer expired-jwt";
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid JWT" } });

    const client = await createClient();
    const result = await client.auth.getUser();

    expect(result.data.user).toBeNull();
    expect(mocks.cookieGetAll).not.toHaveBeenCalled();
    expect(mocks.ssrClient).not.toHaveBeenCalled();
  });

  it("never uses the service-role key", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-secret");
    mocks.headerValue = "Bearer user-jwt";

    await createClient();

    expect(JSON.stringify(mocks.bearerClient.mock.calls)).not.toContain("service-role-secret");
  });

  it("still throws when Supabase env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    await expect(createClient()).rejects.toThrow(/Missing NEXT_PUBLIC_SUPABASE_URL/);
  });
});
