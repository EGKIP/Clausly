import type { OcrInput, OcrProvider } from "../pdf-text";

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
  return withTimeout(runTesseract(tesseract, image, options.language), options.timeoutMs, options.pageNumber);
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, pageNumber: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`OCR timed out after ${timeoutMs}ms on page ${pageNumber}.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
