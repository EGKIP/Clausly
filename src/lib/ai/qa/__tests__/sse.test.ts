import { describe, expect, it } from "vitest";
import { encodeSseFrame } from "../sse";

describe("encodeSseFrame", () => {
  it("encodes an event name and JSON payload in SSE wire format", () => {
    const decoded = new TextDecoder().decode(encodeSseFrame("token", { text: "hello" }));

    expect(decoded).toBe('event: token\ndata: {"text":"hello"}\n\n');
  });
});
