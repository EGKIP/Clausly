import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseClient, db, jsonRequest, resetSupabaseMock, seedUser, setSupabaseEnv, userA } from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));

import { GET, PATCH } from "../route";

describe("/api/profile", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("returns the mock-mode payload when Supabase env is absent", async () => {
    setSupabaseEnv(false);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ mockMode: true, email: "demo@clausly.app" });
  });

  it("returns 400 for empty displayName", async () => {
    const response = await PATCH(jsonRequest({ displayName: "" }, { method: "PATCH" }));

    expect(response.status).toBe(400);
  });

  it("returns 400 for displayName over 80 characters", async () => {
    const response = await PATCH(jsonRequest({ displayName: "A".repeat(81) }, { method: "PATCH" }));

    expect(response.status).toBe(400);
  });

  it("updates the caller profile", async () => {
    seedUser(userA, { full_name: "Ada" });

    const response = await PATCH(jsonRequest({ displayName: "Ada Claus" }, { method: "PATCH" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.displayName).toBe("Ada Claus");
    expect(db().users[0].full_name).toBe("Ada Claus");
  });
});
