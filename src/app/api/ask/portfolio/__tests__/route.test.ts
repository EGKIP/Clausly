import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  jsonRequest,
  resetSupabaseMock,
  rpcCalls,
  seedDocument,
  seedDocumentChunk,
  setSupabaseUser,
  userA,
} from "@/../tests/helpers/supabase";

const qaProviderMock = vi.hoisted(() => vi.fn());
const qaStreamProviderMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));
vi.mock("@/lib/ai/qa/portfolio-provider", () => ({
  getPortfolioQAProvider: () => qaProviderMock,
  getPortfolioQAStreamProvider: () => qaStreamProviderMock,
}));

import { POST } from "../route";

describe("POST /api/ask/portfolio", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    qaProviderMock.mockReset();
    qaProviderMock.mockResolvedValue({
      answer: "Greenfield Lease and Acme NDA are both relevant.",
      citationChunkIds: ["lease-chunk", "nda-chunk"],
    });
    qaStreamProviderMock.mockImplementation(async function* () {
      yield { type: "token", text: "Greenfield" };
      yield { type: "token", text: " Lease" };
      yield { type: "done" };
    });
  });

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await POST(jsonRequest({ question: "Which contracts expire soonest?" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 for an invalid body", async () => {
    const response = await POST(jsonRequest({ question: "no" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid question.");
  });

  it("returns 409 when the portfolio has no indexed chunks", async () => {
    const response = await POST(jsonRequest({ question: "Which contracts expire soonest?" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "Upload a document first.", code: "PORTFOLIO_EMPTY" });
    expect(rpcCalls()[0]).toMatchObject({
      name: "match_portfolio_chunks",
      args: { match_count: 12, per_doc_cap: 3 },
    });
  });

  it("answers across documents with citations and logs usage", async () => {
    const lease = seedDocument(userA, { id: "lease-doc", title: "Greenfield Lease" });
    const nda = seedDocument(userA, { id: "nda-doc", title: "Acme NDA" });
    seedDocumentChunk(lease.id, userA, {
      id: "lease-chunk",
      content: "Greenfield Lease expires on 2026-09-01 unless renewed.",
      page_number: 2,
    });
    seedDocumentChunk(nda.id, userA, {
      id: "nda-chunk",
      content: "Acme NDA confidentiality obligations survive until 2027-01-01.",
      page_number: 4,
    });

    const response = await POST(jsonRequest({ question: "Which contracts expire soonest?" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(rpcCalls()[0]).toMatchObject({
      name: "match_portfolio_chunks",
      args: { match_count: 12, per_doc_cap: 3 },
    });
    expect(qaProviderMock).toHaveBeenCalledWith({
      question: "Which contracts expire soonest?",
      chunks: [
        expect.objectContaining({
          id: "lease-chunk",
          documentId: lease.id,
          documentTitle: "Greenfield Lease",
        }),
        expect.objectContaining({
          id: "nda-chunk",
          documentId: nda.id,
          documentTitle: "Acme NDA",
        }),
      ],
    });
    expect(body).toEqual({
      answer: "Greenfield Lease and Acme NDA are both relevant.",
      citations: [
        {
          documentId: lease.id,
          documentTitle: "Greenfield Lease",
          chunkId: "lease-chunk",
          pageNumber: 2,
          snippet: "Greenfield Lease expires on 2026-09-01 unless renewed.",
        },
        {
          documentId: nda.id,
          documentTitle: "Acme NDA",
          chunkId: "nda-chunk",
          pageNumber: 4,
          snippet: "Acme NDA confidentiality obligations survive until 2027-01-01.",
        },
      ],
    });
    expect(db().usage_metrics).toHaveLength(1);
    expect(db().usage_metrics[0]).toMatchObject({
      user_id: userA.id,
      document_id: null,
      job_type: "qa_portfolio",
      status: "completed",
    });
  });

  it("streams portfolio citations, token frames, and done when requested", async () => {
    const lease = seedDocument(userA, { id: "lease-doc", title: "Greenfield Lease" });
    const nda = seedDocument(userA, { id: "nda-doc", title: "Acme NDA" });
    seedDocumentChunk(lease.id, userA, {
      id: "lease-chunk",
      content: "Greenfield Lease expires on 2026-09-01 unless renewed.",
      page_number: 2,
    });
    seedDocumentChunk(nda.id, userA, {
      id: "nda-chunk",
      content: "Acme NDA confidentiality obligations survive until 2027-01-01.",
      page_number: 4,
    });

    const response = await POST(jsonRequest(
      { question: "Which contracts expire soonest?" },
      { headers: { Accept: "text/event-stream" } },
    ));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("event: citations");
    expect(body).toContain('"documentTitle":"Greenfield Lease"');
    expect(body).toContain('"documentTitle":"Acme NDA"');
    expect(body).toContain("event: token");
    expect(body).toContain("event: done");
    expect(db().usage_metrics).toHaveLength(1);
    expect(db().usage_metrics[0]).toMatchObject({
      user_id: userA.id,
      document_id: null,
      job_type: "qa_portfolio",
      status: "completed",
    });
  });
});
