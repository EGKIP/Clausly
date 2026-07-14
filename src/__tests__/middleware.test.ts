import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } })),
    },
  })),
}));

describe("middleware OAuth fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  });

  it("forwards misplaced OAuth codes to the auth callback route", async () => {
    const { middleware } = await import("../../middleware");
    const request = new NextRequest(
      "https://clausly.test/?code=oauth-code&next=%2Fdashboard"
    );

    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://clausly.test/auth/callback?code=oauth-code&next=%2Fdashboard"
    );
  });
});
