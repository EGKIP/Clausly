import { describe, expect, it } from "vitest";
import { isJpegSignature, isPdfSignature, isPngSignature, isZipSignature, looksLikeTextContent } from "../pdf-signature";

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

describe("contract file signatures", () => {
  it("recognizes DOCX zip signatures", () => {
    expect(isZipSignature(bytesOf("PK\x03\x04docx"))).toBe(true);
    expect(isZipSignature(bytesOf("%PDF"))).toBe(false);
  });

  it("recognizes PNG signatures", () => {
    expect(isPngSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(isPngSignature(bytesOf("not-png"))).toBe(false);
  });

  it("recognizes JPEG signatures", () => {
    expect(isJpegSignature(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(isJpegSignature(bytesOf("not-jpeg"))).toBe(false);
  });
});

describe("looksLikeTextContent", () => {
  it("accepts plain contract text", () => {
    expect(looksLikeTextContent(bytesOf("This Service Agreement is entered into as of...\nSection 1. Term.\n"))).toBe(true);
  });

  it("accepts empty content", () => {
    expect(looksLikeTextContent(new Uint8Array(0))).toBe(true);
  });

  it("rejects content containing a NUL byte", () => {
    expect(looksLikeTextContent(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00, 0x31, 0x2e, 0x34]))).toBe(false);
  });

  it("rejects content dense with non-printable control bytes", () => {
    const binary = new Uint8Array(64).map((_, index) => (index % 3 === 0 ? 0x01 : 0x41));
    expect(looksLikeTextContent(binary)).toBe(false);
  });

  it("tolerates a small amount of unusual whitespace", () => {
    const mostlyText = bytesOf("a".repeat(200));
    const withFormFeed = new Uint8Array([...mostlyText, 0x0c]);
    expect(looksLikeTextContent(withFormFeed)).toBe(true);
  });
});
