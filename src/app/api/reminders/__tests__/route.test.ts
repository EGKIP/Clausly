import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseClient, db, jsonRequest, resetSupabaseMock, seedDocument, setSupabaseUser, userA } from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));

import { POST } from "../route";

describe("POST /api/reminders", () => {
  beforeEach(() => resetSupabaseMock(userA));

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
