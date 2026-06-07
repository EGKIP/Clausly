import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseClient, db, jsonRequest, resetSupabaseMock, seedUser, setSupabaseUser, userA } from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));

import { POST } from "../route";

describe("POST /api/onboarding/complete", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await POST(jsonRequest({}));

    expect(response.status).toBe(401);
  });

  it("sets onboarded_at for the caller", async () => {
    seedUser(userA);

    const response = await POST(jsonRequest({}));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.onboardedAt).toBeTruthy();
    expect(db().users[0].onboarded_at).toBe(body.onboardedAt);
  });

  it("is idempotent when called twice", async () => {
    seedUser(userA);

    const first = await POST(jsonRequest({}));
    const second = await POST(jsonRequest({}));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(db().users[0].onboarded_at).toBeTruthy();
  });
});
