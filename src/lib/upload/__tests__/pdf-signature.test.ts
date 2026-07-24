import { describe, expect, it } from "vitest";
import { isJpegSignature, isPdfSignature, isPngSignature, isZipSignature } from "../pdf-signature";

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
