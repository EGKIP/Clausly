import { describe, expect, it } from "vitest";
import { isPdfSignature } from "../pdf-signature";

function bytesOf(text: string) {
  return new TextEncoder().encode(text);
}

describe("isPdfSignature", () => {
  it("accepts bytes starting with the PDF magic number", () => {
    expect(isPdfSignature(bytesOf("%PDF-1.7\n..."))).toBe(true);
    expect(isPdfSignature(bytesOf("%PDF"))).toBe(true);
  });

  it("rejects bytes that don't start with the PDF magic number", () => {
    expect(isPdfSignature(bytesOf("not a pdf"))).toBe(false);
    expect(isPdfSignature(bytesOf("PK\x03\x04"))).toBe(false); // zip/docx signature
  });

  it("rejects input shorter than the magic number", () => {
    expect(isPdfSignature(bytesOf("%PD"))).toBe(false);
    expect(isPdfSignature(new Uint8Array(0))).toBe(false);
  });
});
