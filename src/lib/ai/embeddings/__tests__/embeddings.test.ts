import { beforeEach, describe, expect, it, vi } from "vitest";
import { embedDocumentChunks } from "../index";
import {
  createMockEmbedding,
  embedWithMockProvider,
  getEmbeddingModel,
  getEmbeddingProviderName,
} from "../provider";
import {
  createSupabaseClient,
  db,
  resetSupabaseMock,
  seedDocument,
  seedDocumentChunk,
  seedUser,
  userA,
} from "@/../tests/helpers/supabase";

type EmbedSupabaseClient = Parameters<typeof embedDocumentChunks>[0];

describe("embedding providers", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CLAUSLY_EMBEDDING_PROVIDER;
    delete process.env.CLAUSLY_EMBEDDING_MODEL;
    delete process.env.CLAUSLY_AI_PROVIDER;
  });

  it("creates deterministic 1536-dimension mock vectors", async () => {
    const first = await embedWithMockProvider(["termination clause"]);
    const second = await embedWithMockProvider(["termination clause"]);
    const different = createMockEmbedding("renewal clause");

    expect(first[0]).toHaveLength(1536);
    expect(first[0]).toEqual(second[0]);
    expect(first[0]).not.toEqual(different);
  });

  it("selects OpenAI embeddings only when explicitly configured or inherited from OpenAI analysis", () => {
    expect(getEmbeddingProviderName()).toBe("mock");

    process.env.CLAUSLY_AI_PROVIDER = "openai";
    expect(getEmbeddingProviderName()).toBe("openai");

    process.env.CLAUSLY_EMBEDDING_PROVIDER = "mock";
    expect(getEmbeddingProviderName()).toBe("mock");
  });

  it("uses text-embedding-3-small unless overridden", () => {
    expect(getEmbeddingModel()).toBe("text-embedding-3-small");

    process.env.CLAUSLY_EMBEDDING_MODEL = "custom-embedding-model";
    expect(getEmbeddingModel()).toBe("custom-embedding-model");
  });
});

describe("embedDocumentChunks", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    seedUser(userA);
  });

  it("caps embedding batches at 100 chunks", async () => {
    const supabase = createSupabaseClient() as unknown as EmbedSupabaseClient;
    const document = seedDocument(userA);
    const provider = vi.fn(async (texts: string[]) => texts.map(() => createMockEmbedding("batch")));
    const fullText = Array.from({ length: 101 }, (_, index) => `Paragraph ${index} ${"x".repeat(1500)}`).join("\n\n");

    const result = await embedDocumentChunks(supabase, document.id, userA.id, fullText, { provider });

    expect(result.indexed).toBe(101);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(provider.mock.calls[0][0]).toHaveLength(100);
    expect(provider.mock.calls[1][0]).toHaveLength(1);
  });

  it("replaces existing chunks when re-indexing", async () => {
    const supabase = createSupabaseClient() as unknown as EmbedSupabaseClient;
    const document = seedDocument(userA);
    seedDocumentChunk(document.id, userA, {
      chunk_index: 0,
      content: "Stale extracted text.",
      embedding: createMockEmbedding("stale"),
    });

    const result = await embedDocumentChunks(
      supabase,
      document.id,
      userA.id,
      "Fresh paragraph about renewal.\n\nFresh paragraph about termination.",
      { provider: embedWithMockProvider },
    );

    expect(result.indexed).toBe(1);
    expect(db().document_chunks).toHaveLength(1);
    expect(db().document_chunks[0]).toMatchObject({
      document_id: document.id,
      user_id: userA.id,
      chunk_index: 0,
      content: "Fresh paragraph about renewal.\n\nFresh paragraph about termination.",
    });
  });

  it("returns zero indexed chunks and the error instead of throwing on provider errors", async () => {
    const supabase = createSupabaseClient() as unknown as EmbedSupabaseClient;
    const document = seedDocument(userA);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await embedDocumentChunks(supabase, document.id, userA.id, "Valid text to index.", {
      provider: async () => {
        throw new Error("Embedding provider down.");
      },
    });

    expect(result).toEqual({ indexed: 0, error: "Embedding provider down." });
    expect(db().document_chunks).toHaveLength(0);
    expect(errorLog).toHaveBeenCalledWith("Document chunk indexing failed.", {
      documentId: document.id,
      provider: "mock",
      message: "Embedding provider down.",
    });
    errorLog.mockRestore();
  });
});
