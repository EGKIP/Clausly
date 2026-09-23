import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  resetSupabaseMock,
  seedDocument,
  seedDocumentChunk,
  seedPortfolioSuggestion,
  seedUser,
  setSupabaseUser,
  userA,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));
// after() requires Next's request-scope context, which direct unit-test
// calls to route handlers don't set up — run the callback immediately
// instead (same shim as the upload route tests).
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (callback: () => unknown) => { void callback(); } };
});
// Real embedding content doesn't matter to the mock rpc below; mocking this
// out lets the "in flight" test hold generation open with a deferred promise.
vi.mock("@/lib/ai/embeddings/provider", () => ({
  getEmbeddingProvider: vi.fn(() => async (texts: string[]) => texts.map(() => [0])),
}));

import { getEmbeddingProvider } from "@/lib/ai/embeddings/provider";
import { GET } from "../route";

describe("GET /api/ask/portfolio/suggested-questions", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
  });

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns 403 for free users", async () => {
    seedUser(userA, { subscription_tier: "free" });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Portfolio suggestions require Pro.", code: "INSIGHTS_REQUIRED" });
  });

  it("returns cached suggestions for Pro users when the document count matches", async () => {
    seedUser(userA, { subscription_tier: "pro" });
    seedDocument(userA, { id: "doc-1" });
    seedPortfolioSuggestion(userA, {
      document_count: 1,
      suggestions: ["Cached one?", "Cached two?", "Cached three?", "Cached four?"],
      generated_at: new Date().toISOString(),
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      suggestions: ["Cached one?", "Cached two?", "Cached three?", "Cached four?"],
      pending: false,
    });
  });

  it("returns pending and fills cache for Pro users on cache miss", async () => {
    seedUser(userA, { subscription_tier: "pro" });
    const document = seedDocument(userA, { id: "doc-1" });
    seedDocumentChunk(document.id, userA);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ suggestions: [], pending: true });
    await vi.waitFor(() => {
      expect(db().portfolio_suggestions).toHaveLength(1);
      expect(db().usage_metrics).toEqual([
        expect.objectContaining({ job_type: "qa_suggest", document_id: null }),
      ]);
    });
  });

  it("does not re-trigger generation (or a second usage charge) for a poll that lands while one is already in flight", async () => {
    seedUser(userA, { subscription_tier: "pro" });
    const document = seedDocument(userA, { id: "doc-1" });
    seedDocumentChunk(document.id, userA);

    const embedding = deferred<number[][]>();
    vi.mocked(getEmbeddingProvider).mockReturnValueOnce(() => embedding.promise);

    const first = await GET();
    expect(await first.json()).toEqual({ suggestions: [], pending: true });

    // Mirrors the client's poll (portfolio-ask.tsx) landing before the
    // first generation (still blocked on the embedding call) has persisted.
    const second = await GET();
    expect(await second.json()).toEqual({ suggestions: [], pending: true });
    expect(db().usage_metrics).toHaveLength(0);

    embedding.resolve([[0]]);
    await vi.waitFor(() => {
      expect(db().portfolio_suggestions).toHaveLength(1);
      expect(db().usage_metrics).toHaveLength(1);
    });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}
