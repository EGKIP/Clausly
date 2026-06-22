import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  resetSupabaseMock,
  seedClause,
  seedDocument,
  seedUsageMetric,
  seedUser,
  setSupabaseEnv,
  setSupabaseUser,
  userA,
  userB,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));
vi.mock("@/lib/ai/embeddings/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/embeddings/provider")>();
  return {
    ...actual,
    getEmbeddingProvider: () => async (texts: string[]) => texts.map((text) =>
      text.includes("Notice period") ? [1, 0, 0] : [0, 1, 0]
    ),
  };
});

import { GET } from "../route";

describe("GET /api/compare", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    seedUser(userA, { subscription_tier: "free" });
  });

  it("returns a mocked comparison when Supabase is not configured", async () => {
    setSupabaseEnv(false);

    const response = await GET(new Request("http://localhost.test/api/compare?a=demo-a&b=demo-b"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.pairs[0].diff).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "remove", value: "30" }),
      expect.objectContaining({ type: "add", value: "60" }),
    ]));
  });

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await GET(new Request("http://localhost.test/api/compare?a=a&b=b"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when document A is not owned by the caller", async () => {
    const other = seedDocument(userB);
    const owned = seedDocument(userA);

    const response = await GET(new Request(`http://localhost.test/api/compare?a=${other.id}&b=${owned.id}`));

    expect(response.status).toBe(404);
  });

  it("returns 404 when document B is not owned by the caller", async () => {
    const owned = seedDocument(userA);
    const other = seedDocument(userB);

    const response = await GET(new Request(`http://localhost.test/api/compare?a=${owned.id}&b=${other.id}`));

    expect(response.status).toBe(404);
  });

  it("compares owned documents and records one Q&A usage row", async () => {
    const a = seedDocument(userA, { title: "Lease v1", document_type: "lease" });
    const b = seedDocument(userA, { title: "Lease v2", document_type: "lease" });
    seedClause(a.id, userA, {
      title: "Notice period",
      category: "Renewal",
      source_quote: "Tenant must give 30 days written notice.",
      plain_english: "Give 30 days notice.",
    });
    seedClause(b.id, userA, {
      title: "Notice period",
      category: "Renewal",
      source_quote: "Tenant must give 60 days written notice.",
      plain_english: "Give 60 days notice.",
    });

    const response = await GET(new Request(`http://localhost.test/api/compare?a=${a.id}&b=${b.id}`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      a: { id: a.id, title: "Lease v1", document_type: "lease" },
      b: { id: b.id, title: "Lease v2", document_type: "lease" },
    });
    expect(payload.pairs).toHaveLength(1);
    expect(payload.pairs[0].diff).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "remove", value: "30" }),
      expect.objectContaining({ type: "add", value: "60" }),
    ]));
    expect(db().usage_metrics).toHaveLength(1);
    expect(db().usage_metrics[0]).toMatchObject({
      user_id: userA.id,
      document_id: a.id,
      job_type: "qa_question",
      provider: "compare",
    });
  });

  it("does not leak cross-tenant clauses through owned document comparison", async () => {
    const a = seedDocument(userA);
    const b = seedDocument(userA);
    seedClause(a.id, userA, { title: "Owned A" });
    seedClause(b.id, userA, { title: "Owned B" });
    seedClause(b.id, userB, { title: "Leaked clause", user_id: userB.id });

    const response = await GET(new Request(`http://localhost.test/api/compare?a=${a.id}&b=${b.id}`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    const titles = payload.pairs.flatMap((pair: { aClause?: { title: string }; bClause?: { title: string } }) => [
      pair.aClause?.title,
      pair.bClause?.title,
    ]);
    expect(titles).not.toContain("Leaked clause");
  });

  it("returns 429 when the user has exhausted the Q&A budget", async () => {
    const a = seedDocument(userA);
    const b = seedDocument(userA);
    for (let index = 0; index < 25; index += 1) {
      seedUsageMetric(userA, { created_at: new Date().toISOString() });
    }

    const response = await GET(new Request(`http://localhost.test/api/compare?a=${a.id}&b=${b.id}`));
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload).toMatchObject({ code: "QA_RATE_LIMIT", limit: 25, plan: "free" });
  });
});
