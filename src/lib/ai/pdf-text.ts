import { withTimeout } from "./with-timeout";
import { NoTextLayerError } from "./errors";

export { NoTextLayerError } from "./errors";

const MAX_EXTRACTED_CHARS = 50_000;
const MIN_TEXT_LAYER_CHARS = 200;
const OCR_PAGE_LIMIT = 20;
const OCR_TIMEOUT_MS = 90_000;
const EXTRACTION_TIMEOUT_MS = 45_000;
const PDF_WORKER_DATA_URL_ENVIRONMENTS = new Set(["production", "development"]);

type NodeCanvasRuntime = {
  DOMMatrix: unknown;
  DOMPoint: unknown;
  DOMRect: unknown;
  ImageData: unknown;
  Path2D: unknown;
};

export type OcrInput = Blob | string;

export type OcrPageImage = {
  image: OcrInput;
  pageNumber: number;
};

export type OcrPageImages = {
  pages: OcrPageImage[];
  totalPages: number;
};

export type OcrProvider = {
  recognize(image: OcrInput, options: { language: "eng"; timeoutMs: number; pageNumber: number }): Promise<string>;
};

export type ExtractPdfTextWithOcrOptions = {
  ocrEnabled?: boolean;
  minTextLayerChars?: number;
  maxExtractedChars?: number;
  ocrPageLimit?: number;
  ocrTimeoutMs?: number;
  ocrProvider?: OcrProvider;
  extractTextLayer?: (file: Blob) => Promise<string>;
  renderPageImages?: (file: Blob, options: { pageLimit: number }) => Promise<OcrPageImages>;
  warn?: (message: string) => void;
};

export type ExtractImageTextOptions = {
  ocrEnabled?: boolean;
  ocrProvider?: OcrProvider;
  ocrTimeoutMs?: number;
};

export async function extractPdfText(blob: Blob): Promise<string> {
  const text = await extractTextLayer(blob);
  if (!text) {
    throw new NoTextLayerError("PDF text extraction returned no text. OCR is not available yet.");
  }
  return text;
}

export async function extractPdfTextWithOcr(file: Blob, options: ExtractPdfTextWithOcrOptions = {}): Promise<string> {
  const textLayer = await (options.extractTextLayer ?? extractTextLayer)(file);
  const maxExtractedChars = options.maxExtractedChars ?? MAX_EXTRACTED_CHARS;
  const minTextLayerChars = options.minTextLayerChars ?? MIN_TEXT_LAYER_CHARS;

  if (nonWhitespaceLength(textLayer) >= minTextLayerChars) {
    return textLayer.slice(0, maxExtractedChars);
  }

  if (!isOcrEnabled(options.ocrEnabled)) {
    if (!textLayer) {
      throw new NoTextLayerError("PDF text extraction returned no text. OCR is disabled.");
    }
    return textLayer.slice(0, maxExtractedChars);
  }

  const pageLimit = options.ocrPageLimit ?? OCR_PAGE_LIMIT;
  const timeoutMs = options.ocrTimeoutMs ?? OCR_TIMEOUT_MS;
  const warn = options.warn ?? ((message: string) => console.warn(message));
  const renderPageImages = options.renderPageImages ?? renderPdfPageImages;
  const ocrProvider = options.ocrProvider ?? (await loadDefaultOcrProvider());
  const pageImages = await renderPageImages(file, { pageLimit });

  if (pageImages.totalPages > pageLimit) {
    warn(`OCR is limited to the first ${pageLimit} pages; skipped ${pageImages.totalPages - pageLimit} later pages.`);
  }

  const ocrTextParts = [];
  for (const page of pageImages.pages.slice(0, pageLimit)) {
    ocrTextParts.push(await ocrProvider.recognize(page.image, { language: "eng", timeoutMs, pageNumber: page.pageNumber }));
  }

  const ocrText = ocrTextParts.join("\n").trim();
  if (!ocrText) {
    throw new NoTextLayerError("PDF OCR fallback returned no text.");
  }

  return ocrText.slice(0, maxExtractedChars);
}

export async function extractImageText(image: Blob, options: ExtractImageTextOptions = {}): Promise<string> {
  if (!isOcrEnabled(options.ocrEnabled)) {
    throw new NoTextLayerError("Image upload requires OCR, but OCR is disabled.");
  }

  const timeoutMs = options.ocrTimeoutMs ?? OCR_TIMEOUT_MS;
  const ocrProvider = options.ocrProvider ?? (await loadDefaultOcrProvider());
  const text = (await ocrProvider.recognize(image, { language: "eng", timeoutMs, pageNumber: 1 })).trim();
  if (!text) {
    throw new NoTextLayerError("Image OCR fallback returned no text.");
  }

  return text.slice(0, MAX_EXTRACTED_CHARS);
}

async function extractTextLayer(blob: Blob): Promise<string> {
  await ensurePdfNodeRuntime();
  const PDFParse = await loadPdfParser();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const parser = new PDFParse({ data: bytes });

  try {
    const result = await withTimeout(parser.getText(), EXTRACTION_TIMEOUT_MS, "PDF text extraction timed out.");
    const text = result.text.trim();
    return text.slice(0, MAX_EXTRACTED_CHARS);
  } finally {
    await parser.destroy();
  }
}

async function renderPdfPageImages(file: Blob, options: { pageLimit: number }): Promise<OcrPageImages> {
  await ensurePdfNodeRuntime();
  const PDFParse = await loadPdfParser();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parser = new PDFParse({ data: bytes });

  try {
    const result = await parser.getScreenshot({
      first: options.pageLimit,
      imageBuffer: true,
      imageDataUrl: true,
      desiredWidth: 1600,
    });

    return {
      totalPages: result.total,
      pages: result.pages.map((page) => ({
        image: page.dataUrl || new Blob([toArrayBuffer(page.data)], { type: "image/png" }),
        pageNumber: page.pageNumber,
      })),
    };
  } finally {
    await parser.destroy();
  }
}

async function loadDefaultOcrProvider(): Promise<OcrProvider> {
  const { tesseractOcrProvider } = await import("./ocr/tesseract-provider");
  return tesseractOcrProvider;
}

async function loadPdfParser(): Promise<typeof import("pdf-parse").PDFParse> {
  const { PDFParse } = await import("pdf-parse");

  if (PDF_WORKER_DATA_URL_ENVIRONMENTS.has(process.env.NODE_ENV ?? "")) {
    const { getData } = await import("pdf-parse/worker");
    PDFParse.setWorker(getData());
  }

  return PDFParse;
}

function isOcrEnabled(override: boolean | undefined) {
  if (override !== undefined) return override;
  return typeof process !== "undefined" && process.env.CLAUSLY_OCR_ENABLED === "true";
}

function nonWhitespaceLength(text: string) {
  return text.replace(/\s/g, "").length;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function ensurePdfNodeRuntime() {
  const runtime = globalThis as typeof globalThis & {
    DOMMatrix?: unknown;
    DOMPoint?: unknown;
    DOMRect?: unknown;
    ImageData?: unknown;
    Path2D?: unknown;
  };

  if (runtime.DOMMatrix && runtime.DOMPoint && runtime.DOMRect && runtime.ImageData && runtime.Path2D) {
    return;
  }

  const canvas = await loadNodeCanvasRuntime();

  installGlobalIfMissing("DOMMatrix", canvas.DOMMatrix);
  installGlobalIfMissing("DOMPoint", canvas.DOMPoint);
  installGlobalIfMissing("DOMRect", canvas.DOMRect);
  installGlobalIfMissing("ImageData", canvas.ImageData);
  installGlobalIfMissing("Path2D", canvas.Path2D);
}

function installGlobalIfMissing(name: string, value: unknown) {
  if (!Reflect.get(globalThis, name)) {
    Reflect.set(globalThis, name, value);
  }
}

async function loadNodeCanvasRuntime(): Promise<NodeCanvasRuntime> {
  const testRuntime = Reflect.get(globalThis, "__CLAUSLY_NODE_CANVAS_RUNTIME__");
  if (isNodeCanvasRuntime(testRuntime)) {
    return testRuntime;
  }

  if (process.env.NODE_ENV === "test") {
    return testNodeCanvasRuntime;
  }

  return import("@napi-rs/canvas");
}

function isNodeCanvasRuntime(value: unknown): value is NodeCanvasRuntime {
  return Boolean(
    value &&
      typeof value === "object" &&
      "DOMMatrix" in value &&
      "DOMPoint" in value &&
      "DOMRect" in value &&
      "ImageData" in value &&
      "Path2D" in value
  );
}

class TestDOMMatrix {}
class TestDOMPoint {}
class TestDOMRect {}
class TestImageData {}
class TestPath2D {}

const testNodeCanvasRuntime: NodeCanvasRuntime = {
  DOMMatrix: TestDOMMatrix,
  DOMPoint: TestDOMPoint,
  DOMRect: TestDOMRect,
  ImageData: TestImageData,
  Path2D: TestPath2D,
};
