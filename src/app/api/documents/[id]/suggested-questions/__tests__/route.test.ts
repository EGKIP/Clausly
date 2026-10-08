import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  resetSupabaseMock,
  routeContext,
  seedDocument,
  seedDocumentChunk,
  seedDocumentSuggestion,
  seedUsageMetric,
  setSupabaseUser,
  userA,
  userB,
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

describe("GET /api/documents/[id]/suggested-questions", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
  });

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await GET(new Request("http://localhost.test"), routeContext("missing"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when the document belongs to another user", async () => {
    const document = seedDocument(userB);

    const response = await GET(new Request("http://localhost.test"), routeContext(document.id));

    expect(response.status).toBe(404);
  });

  it("returns cached suggestions when fresh", async () => {
    const document = seedDocument(userA);
    seedDocumentSuggestion(document.id, {
      suggestions: ["Question one?", "Question two?", "Question three?", "Question four?"],
      generated_at: new Date().toISOString(),
    });

    const response = await GET(new Request("http://localhost.test"), routeContext(document.id));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      suggestions: ["Question one?", "Question two?", "Question three?", "Question four?"],
      pending: false,
    });
  });

  it("returns pending on cache miss and fills the cache in the background", async () => {
    const document = seedDocument(userA);
    seedDocumentChunk(document.id, userA);

    const response = await GET(new Request("http://localhost.test"), routeContext(document.id));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ suggestions: [], pending: true });
    await vi.waitFor(() => {
      expect(db().document_suggestions).toHaveLength(1);
      expect(db().usage_metrics).toEqual([
        expect.objectContaining({ job_type: "qa_suggest", document_id: document.id }),
      ]);
    });
  });

  it("does not re-trigger generation (or a second usage charge) for a poll that lands while one is already in flight", async () => {
    const document = seedDocument(userA);
    seedDocumentChunk(document.id, userA);

    const embedding = deferred<number[][]>();
    vi.mocked(getEmbeddingProvider).mockReturnValueOnce(() => embedding.promise);

    const first = await GET(new Request("http://localhost.test"), routeContext(document.id));
    expect(await first.json()).toEqual({ suggestions: [], pending: true });

    // Mirrors the client's poll (document-view.tsx) landing before the
    // first generation (still blocked on the embedding call) has persisted.
    const second = await GET(new Request("http://localhost.test"), routeContext(document.id));
    expect(await second.json()).toEqual({ suggestions: [], pending: true });
    expect(db().usage_metrics).toHaveLength(0);

    embedding.resolve([[0]]);
    await vi.waitFor(() => {
      expect(db().document_suggestions).toHaveLength(1);
      expect(db().usage_metrics).toHaveLength(1);
    });
  });

  it("returns 429 when uncached suggestions exceed the Q&A budget", async () => {
    const document = seedDocument(userA);
    for (let index = 0; index < 25; index += 1) {
      seedUsageMetric(userA, {
        id: `usage-${index}`,
        job_type: "qa_suggest",
        created_at: new Date().toISOString(),
      });
    }

    const response = await GET(new Request("http://localhost.test"), routeContext(document.id));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toMatchObject({ code: "QA_RATE_LIMIT", used: 25, limit: 25 });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}
