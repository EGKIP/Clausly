import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseClient, db, jsonRequest, resetSupabaseMock, seedDocument, seedReminder, setSupabaseUser, userA } from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));

import { GET, POST } from "../route";

describe("/api/reminders", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("lists only current-user reminders and applies status and document filters", async () => {
    const document = seedDocument(userA);
    const otherDocument = seedDocument(userA, { title: "Other Lease" });
    const approved = seedReminder(document.id, userA, { status: "approved", title: "Approved" });
    seedReminder(otherDocument.id, userA, { status: "approved", title: "Other approved" });
    seedReminder(document.id, userA, { status: "sent", title: "Sent" });
    seedReminder(document.id, userA, { status: "ignored", title: "Ignored" });

    const response = await GET(new Request(`http://localhost.test/api/reminders?status=approved&document_id=${document.id}`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.reminders).toHaveLength(1);
    expect(payload.reminders[0]).toMatchObject({ id: approved.id, title: "Approved", status: "approved" });
  });

  it("returns analysis-created suggested reminders in the suggested filter", async () => {
    // persistAnalysis inserts extracted reminders with status 'suggested';
    // they must surface in the reminders inbox Suggested tab.
    const document = seedDocument(userA);
    const suggested = seedReminder(document.id, userA, {
      status: "suggested",
      title: "Renewal notice due",
      confidence: 0.9,
    });

    const response = await GET(new Request("http://localhost.test/api/reminders?status=suggested"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.reminders).toHaveLength(1);
    expect(payload.reminders[0]).toMatchObject({
      id: suggested.id,
      title: "Renewal notice due",
      status: "suggested",
      docTitle: "Test Lease",
    });
  });

  it("returns 400 for invalid reminder payloads", async () => {
    const response = await POST(jsonRequest({ title: "Missing document" }));

    expect(response.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await POST(jsonRequest({}));

    expect(response.status).toBe(401);
  });

  it("creates a suggested reminder scoped to the session user", async () => {
    const document = seedDocument(userA);

    const response = await POST(jsonRequest({
      documentId: document.id,
      title: "Renewal review",
      description: "Review renewal terms.",
      fireOn: "2026-11-01",
      type: "Review",
      channel: "Email",
    }));

    expect(response.status).toBe(201);
    expect(db().reminders).toHaveLength(1);
    expect(db().reminders[0]).toMatchObject({
      user_id: userA.id,
      document_id: document.id,
      status: "suggested",
      channel: "email",
    });
  });
});
