import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  resetSupabaseMock,
  seedConversation,
  seedMessage,
  setSupabaseUser,
  userA,
  userB,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));

import { GET } from "../route";

describe("GET /api/conversations/[id]/messages", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await GET(request(), routeContext("conversation-1"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when the conversation belongs to another user", async () => {
    seedConversation(userB, { id: "conversation-1" });

    const response = await GET(request(), routeContext("conversation-1"));

    expect(response.status).toBe(404);
  });

  it("returns messages for an owned conversation", async () => {
    const conversation = seedConversation(userA, { id: "conversation-1" });
    seedMessage(conversation.id, { id: "m1", role: "user", content: "Question", created_at: "2026-06-01T10:00:00.000Z" });
    seedMessage(conversation.id, { id: "m2", role: "assistant", content: "Answer", created_at: "2026-06-01T10:01:00.000Z" });

    const response = await GET(request(), routeContext(conversation.id));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.messages).toEqual([
      expect.objectContaining({ id: "m1", role: "user", content: "Question" }),
      expect.objectContaining({ id: "m2", role: "assistant", content: "Answer" }),
    ]);
  });
});

function request() {
  return new Request("http://localhost.test/api/conversations/conversation-1/messages");
}

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}
