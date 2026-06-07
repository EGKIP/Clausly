import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseClient, db, jsonRequest, resetSupabaseMock, routeContext, seedDocument, seedReminder, setSupabaseUser, userA, userB } from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));

import { PATCH } from "../route";

describe("PATCH /api/reminders/[id]", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await PATCH(jsonRequest({ status: "approved" }, { method: "PATCH" }), routeContext("missing"));

    expect(response.status).toBe(401);
  });

  it("does not mutate cross-tenant reminders", async () => {
    const document = seedDocument(userB);
    const reminder = seedReminder(document.id, userB, { status: "suggested" });

    const response = await PATCH(jsonRequest({ status: "approved" }, { method: "PATCH" }), routeContext(reminder.id));

    expect(response.status).toBe(404);
    expect(db().reminders[0].status).toBe("suggested");
  });

  it("updates an owned reminder status", async () => {
    const document = seedDocument(userA);
    const reminder = seedReminder(document.id, userA, { status: "suggested" });

    const response = await PATCH(jsonRequest({ status: "approved" }, { method: "PATCH" }), routeContext(reminder.id));

    expect(response.status).toBe(200);
    expect(db().reminders[0].status).toBe("approved");
  });
});
