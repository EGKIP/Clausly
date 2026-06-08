import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseClient, db, jsonRequest, resetSupabaseMock, routeContext, seedDocument, seedReminder, setSupabaseUser, userA, userB } from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));

import { DELETE, GET, PATCH } from "../route";
import { POST as APPROVE } from "../approve/route";

describe("/api/reminders/[id]", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await PATCH(jsonRequest({ title: "Updated" }, { method: "PATCH" }), routeContext("missing"));

    expect(response.status).toBe(401);
  });

  it("gets a single owned reminder and denies cross-tenant reads", async () => {
    const document = seedDocument(userA);
    const reminder = seedReminder(document.id, userA, { title: "Owned reminder" });
    const otherDocument = seedDocument(userB);
    const otherReminder = seedReminder(otherDocument.id, userB, { title: "Other reminder" });

    const owned = await GET(new Request("http://localhost.test/api/reminders/" + reminder.id), routeContext(reminder.id));
    const blocked = await GET(new Request("http://localhost.test/api/reminders/" + otherReminder.id), routeContext(otherReminder.id));

    expect(owned.status).toBe(200);
    await expect(owned.json()).resolves.toMatchObject({ reminder: { id: reminder.id, title: "Owned reminder" } });
    expect(blocked.status).toBe(404);
  });

  it("does not mutate cross-tenant reminders", async () => {
    const document = seedDocument(userB);
    const reminder = seedReminder(document.id, userB, { status: "suggested" });

    const response = await PATCH(jsonRequest({ title: "Updated" }, { method: "PATCH" }), routeContext(reminder.id));

    expect(response.status).toBe(404);
    expect(db().reminders[0].status).toBe("suggested");
    expect(db().reminders[0].title).toBe("Review notice window");
  });

  it.each(["suggested", "approved"] as const)("patches %s reminders", async (status) => {
    const document = seedDocument(userA);
    const reminder = seedReminder(document.id, userA, { status });

    const response = await PATCH(jsonRequest({
      title: "Renewal review",
      description: "Review updated renewal language.",
      fire_on: "2026-11-15",
      reminder_time: "09:30",
    }, { method: "PATCH" }), routeContext(reminder.id));

    expect(response.status).toBe(200);
    expect(db().reminders[0]).toMatchObject({
      status,
      title: "Renewal review",
      description: "Review updated renewal language.",
      fire_on: "2026-11-15",
      reminder_time: "09:30",
    });
  });

  it("returns 409 when patching a sent reminder", async () => {
    const document = seedDocument(userA);
    const reminder = seedReminder(document.id, userA, { status: "sent", title: "Already sent" });

    const response = await PATCH(jsonRequest({ title: "Updated" }, { method: "PATCH" }), routeContext(reminder.id));

    expect(response.status).toBe(409);
    expect(db().reminders[0].title).toBe("Already sent");
  });

  it("approves suggested reminders and is idempotent for approved reminders with overrides", async () => {
    const document = seedDocument(userA);
    const reminder = seedReminder(document.id, userA, { status: "suggested" });

    const approved = await APPROVE(jsonRequest({ title: "Approved title" }), routeContext(reminder.id));
    const idempotent = await APPROVE(jsonRequest({ description: "Approved again." }), routeContext(reminder.id));

    expect(approved.status).toBe(200);
    expect(idempotent.status).toBe(200);
    expect(db().reminders[0]).toMatchObject({
      status: "approved",
      title: "Approved title",
      description: "Approved again.",
    });
  });

  it("dismisses reminders without deleting the row", async () => {
    const document = seedDocument(userA);
    const reminder = seedReminder(document.id, userA, { status: "approved" });

    const response = await DELETE(new Request("http://localhost.test/api/reminders/" + reminder.id, { method: "DELETE" }), routeContext(reminder.id));

    expect(response.status).toBe(200);
    expect(db().reminders).toHaveLength(1);
    expect(db().reminders[0].status).toBe("ignored");
  });
});
