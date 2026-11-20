import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/notifications/dispatch", () => ({
  hasSupabaseEnv: vi.fn(() => true),
  hasServiceSupabaseEnv: vi.fn(() => true),
  unsubscribeUserEmail: vi.fn(),
}));

import { hasServiceSupabaseEnv, unsubscribeUserEmail } from "@/lib/notifications/dispatch";
import { GET } from "../route";

const unsubscribe = vi.mocked(unsubscribeUserEmail);

function request(query: string) {
  return new Request(`http://localhost.test/api/notifications/unsubscribe?${query}`);
}

function location(response: Response) {
  const target = new URL(response.headers.get("location") ?? "");
  return { path: target.pathname, status: target.searchParams.get("status"), type: target.searchParams.get("type") };
}

describe("GET /api/notifications/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasServiceSupabaseEnv).mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("redirects to a readable confirmation page instead of returning JSON", async () => {
    unsubscribe.mockResolvedValue({ ok: true, status: 200, error: null });

    const response = await GET(request("user_id=u1&token=t1"));

    expect(response.status).toBe(303);
    expect(location(response)).toEqual({ path: "/unsubscribed", status: "done", type: null });
    expect(unsubscribe).toHaveBeenCalledWith({ userId: "u1", token: "t1", type: null });
  });

  it("keeps the weekly digest list type for the confirmation copy", async () => {
    unsubscribe.mockResolvedValue({ ok: true, status: 200, error: null });

    const response = await GET(request("user_id=u1&token=t1&type=weekly_digest"));

    expect(location(response)).toMatchObject({ status: "done", type: "weekly_digest" });
  });

  it("reports an unknown user and a bad token identically, without database error text", async () => {
    unsubscribe.mockResolvedValueOnce({ ok: false, status: 404, error: "invalid input syntax for type uuid" });
    const unknownUser = await GET(request("user_id=nope&token=t1"));
    unsubscribe.mockResolvedValueOnce({ ok: false, status: 400, error: "Invalid unsubscribe token." });
    const badToken = await GET(request("user_id=u1&token=wrong"));

    expect(unknownUser.status).toBe(badToken.status);
    expect(unknownUser.headers.get("location")).toBe(badToken.headers.get("location"));
    expect(location(unknownUser).status).toBe("invalid");
    expect(unknownUser.headers.get("location")).not.toContain("uuid");
  });

  it("treats missing parameters as an invalid link", async () => {
    const response = await GET(request("user_id=u1"));

    expect(location(response).status).toBe("invalid");
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it("shows a generic error page when the update fails or throws", async () => {
    unsubscribe.mockResolvedValueOnce({ ok: false, status: 500, error: "connection reset" });
    const failed = await GET(request("user_id=u1&token=t1"));
    unsubscribe.mockRejectedValueOnce(new Error("Missing CLAUSLY_UNSUBSCRIBE_SECRET."));
    const thrown = await GET(request("user_id=u1&token=t1"));

    expect(location(failed).status).toBe("error");
    expect(location(thrown).status).toBe("error");
    expect(thrown.headers.get("location")).not.toContain("SECRET");
  });

  it("shows the error page when Supabase is not configured", async () => {
    vi.mocked(hasServiceSupabaseEnv).mockReturnValue(false);

    const response = await GET(request("user_id=u1&token=t1"));

    expect(location(response).status).toBe("error");
    expect(unsubscribe).not.toHaveBeenCalled();
  });
});
