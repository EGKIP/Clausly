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

/**
 * Extracts plain text from a stored document file, choosing the extractor by
 * the document's mime type / file name (pasted text, DOCX, image OCR, or PDF).
 * Shared by analysis and the Ask chunk-reindex recovery path so both read
 * every supported upload type the same way.
 */
export async function extractStoredDocumentText(file: Blob, doc: StoredDocumentKind) {
  if (doc.mime_type === "text/plain" || doc.file_name.toLowerCase().endsWith(".txt")) {
    const text = (await readBlobText(file)).trim();
    if (!text) throw new Error("Pasted contract text was empty.");
    return text;
  }

  if (doc.mime_type === DOCX_MIME || doc.file_name.toLowerCase().endsWith(".docx")) {
    return extractDocxText(file);
  }

  if (doc.mime_type.startsWith("image/")) {
    const pdfTextModule = pdfText as PdfTextModule;
    if (!pdfTextModule.extractImageText) throw new Error("Image OCR extractor is unavailable.");
    return pdfTextModule.extractImageText(file);
  }

  return getPdfTextExtractor()(file);
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
