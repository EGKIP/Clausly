import { describe, expect, it } from "vitest";
import { chunkDocumentText } from "../chunking";

describe("chunkDocumentText", () => {
  it("returns an empty array for empty input", () => {
    expect(chunkDocumentText(" \n\n ")).toEqual([]);
  });

  it("prefers paragraph boundaries", () => {
    const chunks = chunkDocumentText("First paragraph.\n\nSecond paragraph.\n\nThird paragraph.", {
      maxChars: 34,
      overlapChars: 0,
    });

    expect(chunks.map((chunk) => chunk.content)).toEqual([
      "First paragraph.",
      "Second paragraph.",
      "Third paragraph.",
    ]);
  });

  it("uses sentence boundaries before hard cutting", () => {
    const chunks = chunkDocumentText("One sentence. Two sentence. Three sentence.", {
      maxChars: 28,
      overlapChars: 0,
    });

    expect(chunks.map((chunk) => chunk.content)).toEqual([
      "One sentence. Two sentence.",
      "Three sentence.",
    ]);
  });

  it("hard cuts very long text when no boundaries fit", () => {
    const chunks = chunkDocumentText("abcdefghij", { maxChars: 4, overlapChars: 0 });

    expect(chunks.map((chunk) => chunk.content)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("respects overlap between chunks", () => {
    const chunks = chunkDocumentText("Alpha paragraph.\n\nBeta paragraph.\n\nGamma paragraph.", {
      maxChars: 35,
      overlapChars: 5,
    });

    expect(chunks[1].content.startsWith("raph.")).toBe(true);
    expect(chunks[1].content).toContain("Gamma paragraph.");
  });

  it("propagates page numbers from form-feed page breaks", () => {
    const chunks = chunkDocumentText("Page one text.\fPage two text.", {
      maxChars: 50,
      overlapChars: 0,
    });

    expect(chunks).toEqual([
      { index: 0, content: "Page one text.", pageNumber: 1 },
      { index: 1, content: "Page two text.", pageNumber: 2 },
    ]);
  });

  it("never produces empty chunks", () => {
    const chunks = chunkDocumentText("\n\nAlpha.\n\n\n\nBeta.", { maxChars: 10, overlapChars: 0 });

    expect(chunks.every((chunk) => chunk.content.length > 0)).toBe(true);
  });
});
