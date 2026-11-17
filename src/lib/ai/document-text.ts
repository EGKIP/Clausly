import * as pdfText from "./pdf-text";
import { extractDocxText } from "./docx-text";

type PdfTextExtractor = typeof pdfText.extractPdfText;
type PdfTextModule = {
  extractPdfText: PdfTextExtractor;
  extractPdfTextWithOcr?: PdfTextExtractor;
  extractImageText?: PdfTextExtractor;
};

export type StoredDocumentKind = {
  file_name: string;
  mime_type: string;
};

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const KNOWN_MIME_TYPES = new Set(["application/pdf", "text/plain", DOCX_MIME, "image/png", "image/jpeg"]);

/**
 * Extracts plain text from a stored document file, choosing the extractor by
 * the document's mime type / file name (pasted text, DOCX, image OCR, or PDF).
 * Shared by analysis and the Ask chunk-reindex recovery path so both read
 * every supported upload type the same way.
 *
 * The stored mime type was set by /api/upload from the file's magic bytes, so
 * it wins over the client-chosen file name (a PDF named `contract.txt` is still
 * a PDF). The extension is only a fallback for rows without a known type.
 */
export async function extractStoredDocumentText(file: Blob, doc: StoredDocumentKind) {
  const kind = storedDocumentKind(doc);

  if (kind === "text") {
    const text = (await readBlobText(file)).trim();
    if (!text) throw new Error("Pasted contract text was empty.");
    return text;
  }

  if (kind === "docx") {
    return extractDocxText(file);
  }

  if (kind === "image") {
    const pdfTextModule = pdfText as PdfTextModule;
    if (!pdfTextModule.extractImageText) throw new Error("Image OCR extractor is unavailable.");
    return pdfTextModule.extractImageText(file);
  }

  return getPdfTextExtractor()(file);
}

function storedDocumentKind(doc: StoredDocumentKind): "text" | "docx" | "image" | "pdf" {
  const mime = doc.mime_type ?? "";
  if (KNOWN_MIME_TYPES.has(mime)) {
    if (mime === "text/plain") return "text";
    if (mime === DOCX_MIME) return "docx";
    if (mime.startsWith("image/")) return "image";
    return "pdf";
  }

  const name = doc.file_name.toLowerCase();
  if (name.endsWith(".txt")) return "text";
  if (name.endsWith(".docx")) return "docx";
  if (mime.startsWith("image/")) return "image";
  return "pdf";
}

function getPdfTextExtractor() {
  const pdfTextModule = pdfText as PdfTextModule;
  if ("extractPdfTextWithOcr" in pdfTextModule) {
    return pdfTextModule.extractPdfTextWithOcr ?? pdfTextModule.extractPdfText;
  }
  return pdfTextModule.extractPdfText;
}

async function readBlobText(file: Blob) {
  if (typeof file.text === "function") return file.text();
  if (typeof Response !== "undefined") return new Response(file).text();
  const bytes = await file.arrayBuffer();
  return new TextDecoder().decode(bytes);
}
