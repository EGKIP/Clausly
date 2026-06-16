import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  jsonRequest,
  resetSupabaseMock,
  routeContext,
  seedDocument,
  seedDocumentChunk,
  seedUsageMetric,
  setSupabaseUser,
  userA,
  userB,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));

import { POST } from "../route";

describe("POST /api/documents/[id]/ask", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
  });

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await POST(jsonRequest({ question: "What is the rent?" }), routeContext("missing"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when the document belongs to another user", async () => {
    const document = seedDocument(userB, { status: "ready" });

    const response = await POST(jsonRequest({ question: "What is the rent?" }), routeContext(document.id));

    expect(response.status).toBe(404);
  });

  it("returns 400 for an invalid body", async () => {
    const document = seedDocument(userA, { status: "ready" });

    const response = await POST(jsonRequest({ question: "no" }), routeContext(document.id));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid question.");
  });

  it("returns 409 when the document is not ready", async () => {
    const document = seedDocument(userA, { status: "analyzing" });

    const response = await POST(jsonRequest({ question: "What is the rent?" }), routeContext(document.id));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "Document is not ready yet.", code: "DOC_NOT_READY" });
  });

  it("returns 409 when chunks are not indexed yet", async () => {
    const document = seedDocument(userA, { status: "ready" });

    const response = await POST(jsonRequest({ question: "What is the rent?" }), routeContext(document.id));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: "Document text is still being indexed, try again shortly.",
      code: "DOC_NOT_INDEXED",
    });
  });

  it("returns JSON 429 before opening a stream when the daily Q&A limit is reached", async () => {
    for (let index = 0; index < 25; index += 1) {
      seedUsageMetric(userA, {
        id: `usage-${index}`,
        job_type: "qa_question",
        created_at: new Date().toISOString(),
      });
    }

    const response = await POST(
      jsonRequest(
        { question: "What is the termination clause?" },
        { headers: { Accept: "text/event-stream" } },
      ),
      routeContext("any-document"),
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toMatchObject({
      error: "You've reached your 25-question daily limit on the free plan.",
      code: "QA_RATE_LIMIT",
      limit: 25,
      used: 25,
      plan: "free",
    });
    expect(body.resetsAt).toBeTruthy();
  });

  it("answers from indexed chunks with citations and logs usage", async () => {
    const document = seedDocument(userA, { status: "ready" });
    const chunk = seedDocumentChunk(document.id, userA, {
      id: "chunk-1",
      content: "The tenant may terminate by giving 60 days written notice before the renewal date.",
      page_number: 4,
    });

    const response = await POST(
      jsonRequest({ question: "What is the termination clause?" }),
      routeContext(document.id),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.answer).toContain("Based on the indexed document excerpts");
    expect(body.citations).toEqual([
      {
        chunkId: chunk.id,
        pageNumber: 4,
        snippet: chunk.content.slice(0, 200),
      },
    ]);
    expect(db().usage_metrics).toHaveLength(1);
    expect(db().usage_metrics[0]).toMatchObject({
      user_id: userA.id,
      document_id: document.id,
      job_type: "qa_question",
      provider: "mock",
      status: "completed",
    });
  });

  it("streams citations, token frames, and done when requested", async () => {
    const document = seedDocument(userA, { status: "ready" });
    seedDocumentChunk(document.id, userA, {
      id: "chunk-1",
      content: "The tenant may terminate by giving 60 days written notice before the renewal date.",
      page_number: 4,
    });

    const response = await POST(
      jsonRequest(
        { question: "What is the termination clause?" },
        { headers: { Accept: "text/event-stream" } },
      ),
      routeContext(document.id),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("event: citations");
    expect(body).toContain('"chunkId":"chunk-1"');
    expect(body).toContain("event: token");
    expect(body).toContain("event: done");
    expect(db().usage_metrics).toHaveLength(1);
    expect(db().usage_metrics[0]).toMatchObject({
      user_id: userA.id,
      document_id: document.id,
      job_type: "qa_question",
      status: "completed",
    });
  });

  it("keeps tenant isolation for cross-tenant ask attempts", async () => {
    const documentA = seedDocument(userA, { status: "ready" });
    seedDocumentChunk(documentA.id, userA, { id: "chunk-a" });

    setSupabaseUser(userB);
    const response = await POST(
      jsonRequest({ question: "What does the notice clause say?" }),
      routeContext(documentA.id),
    );

    expect(response.status).toBe(404);
    expect(db().usage_metrics).toHaveLength(0);
  });
});
