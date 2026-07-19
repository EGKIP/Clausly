import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  answerPortfolioWithMockProvider,
  answerPortfolioWithOpenAIProvider,
  getPortfolioQAProvider,
  streamPortfolioWithOpenAIProvider,
  type PortfolioQAInput,
} from "../portfolio-provider";

const sampleInput: PortfolioQAInput = {
  question: "Which contracts expire soonest?",
  chunks: [
    {
      id: "chunk-lease",
      documentId: "doc-lease",
      documentTitle: "Greenfield Lease",
      content: "The lease expires on 2026-09-01 unless renewed.",
      pageNumber: 2,
    },
    {
      id: "chunk-nda",
      documentId: "doc-nda",
      documentTitle: "Acme NDA",
      content: "Confidentiality obligations survive until 2027-01-01.",
      pageNumber: 4,
    },
  ],
};

function jsonResponse(payload: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response);
}

function streamResponse(frames: string[]) {
  const encoder = new TextEncoder();
  return Promise.resolve({
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const frame of frames) controller.enqueue(encoder.encode(frame));
        controller.close();
      },
    }),
  } as Response);
}

function openAIResponse(payload: unknown) {
  return { output_text: JSON.stringify(payload) };
}

describe("portfolio QA provider", () => {
  beforeEach(() => {
    delete process.env.CLAUSLY_AI_PROVIDER;
    delete process.env.CLAUSLY_AI_MODEL;
    delete process.env.OPENAI_API_KEY;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the mock provider by default and cites the first document chunk", async () => {
    const provider = getPortfolioQAProvider();
    const result = await provider(sampleInput);

    expect(result.answer).toContain("Greenfield Lease");
    expect(result.citationChunkIds).toEqual(["chunk-lease"]);
  });

  it("returns a deterministic mock answer with document title grounding", async () => {
    const result = await answerPortfolioWithMockProvider(sampleInput);

    expect(result.answer).toContain("Greenfield Lease");
    expect(result.answer).toContain("lease expires");
    expect(result.citationChunkIds).toEqual(["chunk-lease"]);
  });

  it("retries once when OpenAI JSON violates the portfolio QA schema", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.CLAUSLY_AI_MODEL = "gpt-test-model";
    vi.mocked(fetch)
      .mockImplementationOnce(() => jsonResponse(openAIResponse({ answer: "" })))
      .mockImplementationOnce(() => jsonResponse(openAIResponse({
        answer: "Greenfield Lease expires first.",
        citationChunkIds: ["chunk-lease"],
      })));

    const result = await answerPortfolioWithOpenAIProvider(sampleInput);

    expect(result).toEqual({
      answer: "Greenfield Lease expires first.",
      citationChunkIds: ["chunk-lease"],
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(fetch).mock.calls[0][1]?.body)).toContain("Greenfield Lease");
    expect(String(vi.mocked(fetch).mock.calls[1][1]?.body)).toContain("Previous JSON failed validation");
    expect(String(vi.mocked(fetch).mock.calls[1][1]?.body)).toContain('"model":"gpt-test-model"');
  });

  it("throws when OpenAI returns invalid JSON twice", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    vi.mocked(fetch).mockImplementation(() => jsonResponse(openAIResponse({ answer: "" })));

    await expect(answerPortfolioWithOpenAIProvider(sampleInput)).rejects.toThrow(/schema validation/i);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("streams plain prose from OpenAI instead of JSON objects", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    vi.mocked(fetch).mockImplementation(() => streamResponse([
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Greenfield expires first."}\n\n',
      'event: response.completed\ndata: {"type":"response.completed"}\n\n',
    ]));

    const events = [];
    for await (const event of streamPortfolioWithOpenAIProvider(sampleInput)) events.push(event);

    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(request.stream).toBe(true);
    expect(request.text).toBeUndefined();
    expect(request.input[0].content).toContain("Do not output JSON");
    expect(events).toContainEqual({ type: "token", text: "Greenfield expires first." });
  });
});
