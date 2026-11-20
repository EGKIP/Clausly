// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../pdf-text", () => ({
  extractPdfText: vi.fn(async () => "pdf text"),
  extractPdfTextWithOcr: vi.fn(async () => "pdf text"),
  extractImageText: vi.fn(async () => "image text"),
}));
vi.mock("../docx-text", () => ({ extractDocxText: vi.fn(async () => "docx text") }));

import { extractStoredDocumentText } from "../document-text";
import { extractPdfTextWithOcr, extractImageText } from "../pdf-text";
import { extractDocxText } from "../docx-text";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const pdfBlob = () => new Blob(["%PDF-1.7 binary"], { type: "application/pdf" });

describe("extractStoredDocumentText", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the PDF extractor for a server-verified PDF even when the file name says .txt", async () => {
    await expect(extractStoredDocumentText(pdfBlob(), { file_name: "contract.txt", mime_type: "application/pdf" }))
      .resolves.toBe("pdf text");
    expect(extractPdfTextWithOcr).toHaveBeenCalledTimes(1);
  });

  it("uses the PDF extractor for a server-verified PDF even when the file name says .docx", async () => {
    await expect(extractStoredDocumentText(pdfBlob(), { file_name: "contract.docx", mime_type: "application/pdf" }))
      .resolves.toBe("pdf text");
    expect(extractDocxText).not.toHaveBeenCalled();
  });

  it("routes each known mime type to its extractor", async () => {
    await expect(extractStoredDocumentText(new Blob([" lease terms "]), { file_name: "a", mime_type: "text/plain" }))
      .resolves.toBe("lease terms");
    await expect(extractStoredDocumentText(new Blob(["PK"]), { file_name: "a", mime_type: DOCX_MIME }))
      .resolves.toBe("docx text");
    await expect(extractStoredDocumentText(new Blob(["x"]), { file_name: "a.png", mime_type: "image/png" }))
      .resolves.toBe("image text");
    expect(extractImageText).toHaveBeenCalledTimes(1);
  });

  it("falls back to the file extension when the stored mime type is not a known upload type", async () => {
    await expect(extractStoredDocumentText(new Blob(["notes"]), { file_name: "old.TXT", mime_type: "application/octet-stream" }))
      .resolves.toBe("notes");
    await expect(extractStoredDocumentText(new Blob(["PK"]), { file_name: "old.docx", mime_type: "" }))
      .resolves.toBe("docx text");
    await expect(extractStoredDocumentText(pdfBlob(), { file_name: "old.pdf", mime_type: "application/octet-stream" }))
      .resolves.toBe("pdf text");
  });

  it("still rejects empty text documents", async () => {
    await expect(extractStoredDocumentText(new Blob(["   "]), { file_name: "a.txt", mime_type: "text/plain" }))
      .rejects.toThrow("Pasted contract text was empty.");
  });
});
