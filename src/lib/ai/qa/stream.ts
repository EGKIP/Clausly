import { answerWithMockProvider, getQAModel, type QAInput } from "./provider";
import { qaStreamingSystemPrompt, qaUserPrompt } from "./prompts";

export type QAStreamEvent =
  | { type: "token"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export type QAStreamProvider = (input: QAInput) => AsyncIterable<QAStreamEvent>;

type MockStreamOptions = {
  delayMs?: number;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export function getQAStreamProvider(): QAStreamProvider {
  if (process.env.CLAUSLY_AI_PROVIDER?.trim().toLowerCase() === "openai") {
    return streamWithOpenAIProvider;
  }
  return (input) => streamWithMockProvider(input);
}

export async function* streamWithMockProvider(
  input: QAInput,
  options: MockStreamOptions = {},
): AsyncIterable<QAStreamEvent> {
  const result = await answerWithMockProvider(input);
  const words = result.answer.split(/\s+/).filter(Boolean);

  for (const [index, word] of words.entries()) {
    if ((options.delayMs ?? 10) > 0) {
      await delay(options.delayMs ?? 10);
    }
    yield { type: "token", text: index === 0 ? word : ` ${word}` };
  }

  yield { type: "done" };
}

export async function* streamWithOpenAIProvider(input: QAInput): AsyncIterable<QAStreamEvent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    yield { type: "error", message: "OpenAI QA streaming provider requires OPENAI_API_KEY." };
    return;
  }

  let response: Response;
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getQAModel(),
        input: [
          { role: "system", content: qaStreamingSystemPrompt() },
          { role: "user", content: qaUserPrompt(input) },
        ],
        stream: true,
      }),
    });
  } catch (error) {
    yield { type: "error", message: error instanceof Error ? error.message : "OpenAI QA streaming request failed." };
    return;
  }

  if (!response.ok) {
    yield { type: "error", message: `OpenAI QA streaming request failed with HTTP ${response.status}.` };
    return;
  }

  if (!response.body) {
    yield { type: "error", message: "OpenAI QA streaming response did not include a body." };
    return;
  }

  for await (const event of parseOpenAISse(response.body)) {
    yield event;
    if (event.type === "done" || event.type === "error") return;
  }

  yield { type: "done" };
}

export async function* parseOpenAISse(body: ReadableStream<Uint8Array>): AsyncIterable<QAStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\n\n/);
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const event = parseOpenAIFrame(frame);
        if (event) yield event;
      }
    }

    if (buffer.trim()) {
      const event = parseOpenAIFrame(buffer);
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseOpenAIFrame(frame: string): QAStreamEvent | null {
  const eventName = frame
    .split(/\n/)
    .find((line) => line.startsWith("event:"))
    ?.slice("event:".length)
    .trim();
  const data = frame
    .split(/\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("\n");

  if (!data || data === "[DONE]") return { type: "done" };

  let parsed: { type?: string; delta?: string; error?: { message?: string } };
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  const type = parsed.type ?? eventName;
  if (type === "response.output_text.delta" && typeof parsed.delta === "string") {
    return { type: "token", text: parsed.delta };
  }
  if (type === "response.completed") return { type: "done" };
  if (type === "response.error") {
    return { type: "error", message: parsed.error?.message ?? "OpenAI QA streaming request failed." };
  }

  return null;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
