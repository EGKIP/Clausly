import type { OcrInput, OcrProvider } from "../pdf-text";
import { withTimeout } from "../with-timeout";

type TesseractModule = typeof import("tesseract.js");

export const tesseractOcrProvider: OcrProvider = {
  async recognize(image, options) {
    return recognizeWithTesseract(image, options);
  },
};

async function recognizeWithTesseract(
  image: OcrInput,
  options: { language: "eng"; timeoutMs: number; pageNumber: number },
): Promise<string> {
  const tesseract = await import("tesseract.js");
  return withTimeout(
    runTesseract(tesseract, image, options.language),
    options.timeoutMs,
    `OCR timed out after ${options.timeoutMs}ms on page ${options.pageNumber}.`
  );
}

async function runTesseract(tesseract: TesseractModule, image: OcrInput, language: "eng") {
  const worker = await tesseract.createWorker(language);

  try {
    const result = await worker.recognize(image);
    return result.data.text.trim();
  } finally {
    await worker.terminate();
  }
}
