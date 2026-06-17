import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  resetSupabaseMock,
  seedConversation,
  setSupabaseUser,
  userA,
  userB,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));

import { GET } from "../route";

describe("GET /api/conversations", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await GET(request("/api/conversations"));

    expect(response.status).toBe(401);
  });

  it("lists recent document conversations scoped to the current user", async () => {
    seedConversation(userA, { id: "old", document_id: "11111111-1111-4111-8111-aaaaaaaaaaaa", title: "Old", created_at: "2026-06-01T10:00:00.000Z" });
    seedConversation(userA, { id: "new", document_id: "11111111-1111-4111-8111-aaaaaaaaaaaa", title: "New", created_at: "2026-06-01T11:00:00.000Z" });
    seedConversation(userA, { id: "portfolio", document_id: null, title: "Portfolio" });
    seedConversation(userB, { id: "other", document_id: "11111111-1111-4111-8111-aaaaaaaaaaaa", title: "Other" });

    const response = await GET(request("/api/conversations?documentId=11111111-1111-4111-8111-aaaaaaaaaaaa&limit=1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.conversations).toEqual([
      expect.objectContaining({ id: "new", title: "New", documentId: "11111111-1111-4111-8111-aaaaaaaaaaaa" }),
    ]);
  });

  it("lists portfolio conversations when no documentId is supplied", async () => {
    seedConversation(userA, { id: "document-chat", document_id: "11111111-1111-4111-8111-aaaaaaaaaaaa" });
    seedConversation(userA, { id: "portfolio-chat", document_id: null, title: "Portfolio chat" });

    const response = await GET(request("/api/conversations"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.conversations).toEqual([
      expect.objectContaining({ id: "portfolio-chat", documentId: null }),
    ]);
  });
});

function request(path: string) {
  return new Request(`http://localhost.test${path}`);
}
