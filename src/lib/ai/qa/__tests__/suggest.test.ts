import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateDocumentSuggestions,
  generatePortfolioSuggestions,
  parseSuggestionResponse,
} from "../suggest";

const chunks = [{ id: "chunk-1", content: "The lease renews unless 60 days notice is sent.", pageNumber: 2 }];

function jsonResponse(payload: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({ output_text: JSON.stringify(payload) }),
  } as Response);
}

describe("suggestion provider", () => {
  beforeEach(() => {
    delete process.env.CLAUSLY_AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns four canned document suggestions in mock mode", async () => {
    await expect(generateDocumentSuggestions(chunks)).resolves.toEqual([
      "What's the termination clause?",
      "When does this auto-renew?",
      "What notice period applies?",
      "Which fees could surprise me?",
    ]);
  });

  it("returns four canned portfolio suggestions in mock mode", async () => {
    await expect(generatePortfolioSuggestions(chunks)).resolves.toHaveLength(4);
  });

  it("parses OpenAI JSON suggestions", async () => {
    process.env.CLAUSLY_AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-key";
    vi.mocked(fetch).mockImplementation(() => jsonResponse({
      suggestions: [
        "What obligations should I review first?",
        "Which notice dates matter most here?",
        "Where could fees increase unexpectedly?",
        "What renewal terms should I compare?",
      ],
    }));

    await expect(generateDocumentSuggestions(chunks)).resolves.toEqual([
      "What obligations should I review first?",
      "Which notice dates matter most here?",
      "Where could fees increase unexpectedly?",
      "What renewal terms should I compare?",
    ]);
  });

  it("rejects non-array suggestion payloads", () => {
    expect(() => parseSuggestionResponse({ suggestions: "not-array" })).toThrow();
  });

  it("rejects suggestions over 90 characters", () => {
    expect(() => parseSuggestionResponse([
      "A".repeat(91),
      "Which notice dates matter most here?",
      "Where could fees increase unexpectedly?",
      "What renewal terms should I compare?",
    ])).toThrow();
  });
});
