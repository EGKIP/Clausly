import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  resetSupabaseMock,
  seedConversation,
  seedMessage,
  userA,
  userB,
} from "@/../tests/helpers/supabase";
import {
  appendMessage,
  getOrCreateConversation,
  listConversations,
  loadConversationMessages,
  touchConversation,
} from "../conversations";

vi.mock("server-only", () => ({}));

describe("conversation data helpers", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("creates a new document-scoped conversation", async () => {
    const conversation = await getOrCreateConversation(
      createSupabaseClient(),
      userA.id,
      "document-1",
      "What is the termination clause?"
    );

    expect(conversation).toMatchObject({
      title: "What is the termination clause?",
      documentId: "document-1",
      isNew: true,
    });
    expect(db().qa_conversations).toEqual([
      expect.objectContaining({
        id: conversation.id,
        user_id: userA.id,
        document_id: "document-1",
      }),
    ]);
  });

  it("reuses an existing conversation id in the same scope", async () => {
    const existing = seedConversation(userA, {
      id: "conversation-1",
      document_id: "document-1",
      title: "Existing chat",
    });

    const conversation = await getOrCreateConversation(
      createSupabaseClient(),
      userA.id,
      "document-1",
      "Follow up",
      existing.id
    );

    expect(conversation).toEqual({
      id: existing.id,
      title: "Existing chat",
      documentId: "document-1",
      isNew: false,
    });
    expect(db().qa_conversations).toHaveLength(1);
  });

  it("loads prior messages in chronological order with the requested limit", async () => {
    const conversation = seedConversation(userA, { id: "conversation-1" });
    seedMessage(conversation.id, { id: "m1", role: "user", content: "One", created_at: "2026-06-01T10:00:00.000Z" });
    seedMessage(conversation.id, { id: "m2", role: "assistant", content: "Two", created_at: "2026-06-01T10:01:00.000Z" });
    seedMessage(conversation.id, { id: "m3", role: "user", content: "Three", created_at: "2026-06-01T10:02:00.000Z" });

    const messages = await loadConversationMessages(createSupabaseClient(), userA.id, conversation.id, 2);

    expect(messages.map((message) => message.content)).toEqual(["Two", "Three"]);
  });

  it("appends a message with citations", async () => {
    const conversation = seedConversation(userA, { id: "conversation-1" });

    const message = await appendMessage(createSupabaseClient(), conversation.id, "assistant", "Answer", [
      { chunkId: "chunk-1" },
    ]);

    expect(message).toMatchObject({
      conversationId: conversation.id,
      role: "assistant",
      content: "Answer",
      citations: [{ chunkId: "chunk-1" }],
    });
  });

  it("lists recent conversations scoped by user and document", async () => {
    seedConversation(userA, { id: "old", document_id: "doc-1", title: "Old", created_at: "2026-06-01T10:00:00.000Z" });
    seedConversation(userA, { id: "new", document_id: "doc-1", title: "New", created_at: "2026-06-01T11:00:00.000Z" });
    seedConversation(userA, { id: "portfolio", document_id: null, title: "Portfolio" });
    seedConversation(userB, { id: "other", document_id: "doc-1", title: "Other user" });

    const conversations = await listConversations(createSupabaseClient(), userA.id, "doc-1", 1);

    expect(conversations).toEqual([
      expect.objectContaining({ id: "new", title: "New", documentId: "doc-1" }),
    ]);
  });

  it("touches the conversation updated_at timestamp", async () => {
    const conversation = seedConversation(userA, { id: "conversation-1" });

    await touchConversation(createSupabaseClient(), conversation.id);

    expect(db().qa_conversations[0].updated_at).not.toBe("2026-06-01T00:00:00.000Z");
  });
});
