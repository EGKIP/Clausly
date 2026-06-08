const MAX_EXTRACTED_CHARS = 50_000;

export async function extractPdfText(blob: Blob): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const parser = new PDFParse({ data: bytes });

  try {
    const result = await parser.getText();
    const text = result.text.trim();
    if (!text) {
      throw new Error("PDF text extraction returned no text. OCR is not available yet.");
    }
    return text.slice(0, MAX_EXTRACTED_CHARS);
  } finally {
    await parser.destroy();
  }
}
