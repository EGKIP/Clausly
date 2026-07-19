import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseOpenAISse, streamWithMockProvider, streamWithOpenAIProvider } from "../stream";
import type { QAInput } from "../provider";

const input: QAInput = {
  question: "What is the termination clause?",
  chunks: [
    {
      id: "chunk-1",
      content: "The tenant may terminate with 60 days written notice.",
      pageNumber: 4,
    },
  ],
};

describe("QA streaming providers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.OPENAI_API_KEY;
    delete process.env.CLAUSLY_AI_MODEL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mock streamer yields token frames and done in order", async () => {
    const events = [];
    for await (const event of streamWithMockProvider(input, { delayMs: 0 })) {
      events.push(event);
    }

    expect(events.at(-1)).toEqual({ type: "done" });
    expect(events.filter((event) => event.type === "token").length).toBeGreaterThan(3);
    expect(events.slice(0, 3)).toEqual([
      { type: "token", text: "Based" },
      { type: "token", text: " on" },
      { type: "token", text: " the" },
    ]);
  });

  it("parses OpenAI SSE token deltas and completion", async () => {
    const stream = openAIStream([
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hello"}\n\n',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":" world"}\n\n',
      'event: response.completed\ndata: {"type":"response.completed"}\n\n',
    ]);

    const events = [];
    for await (const event of parseOpenAISse(stream)) events.push(event);

    expect(events).toEqual([
      { type: "token", text: "Hello" },
      { type: "token", text: " world" },
      { type: "done" },
    ]);
  });

  it("terminates cleanly on OpenAI error events", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      body: openAIStream([
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Before"}\n\n',
        'event: response.error\ndata: {"type":"response.error","error":{"message":"Model failed"}}\n\n',
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":" after"}\n\n',
      ]),
    } as Response);

    const events = [];
    for await (const event of streamWithOpenAIProvider(input)) events.push(event);

    expect(events).toEqual([
      { type: "token", text: "Before" },
      { type: "error", message: "Model failed" },
    ]);
  });

  it("requests plain prose from OpenAI for streaming instead of JSON objects", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      body: openAIStream([
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Plain answer"}\n\n',
        'event: response.completed\ndata: {"type":"response.completed"}\n\n',
      ]),
    } as Response);

    const events = [];
    for await (const event of streamWithOpenAIProvider(input)) events.push(event);

    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(request.stream).toBe(true);
    expect(request.text).toBeUndefined();
    expect(request.input[0].content).toContain("Do not output JSON");
    expect(events).toContainEqual({ type: "token", text: "Plain answer" });
  });
});

function openAIStream(frames: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
}
