import { describe, expect, it, vi } from "vitest";
import { extractPdfTextWithOcr, type OcrProvider } from "../../pdf-text";

const pdfBlob = new Blob(["%PDF-test"], { type: "application/pdf" });

function textOfLength(length: number) {
  return "a".repeat(length);
}

function mockOcrProvider(text = "OCR text"): OcrProvider {
  return {
    recognize: vi.fn(async () => text),
  };
}

describe("extractPdfTextWithOcr", () => {
  it("returns text-layer result when it is above the threshold", async () => {
    const provider = mockOcrProvider();
    const renderPageImages = vi.fn();
    const result = await extractPdfTextWithOcr(pdfBlob, {
      extractTextLayer: async () => textOfLength(200),
      ocrProvider: provider,
      renderPageImages,
      ocrEnabled: true,
    });

    expect(result).toBe(textOfLength(200));
    expect(provider.recognize).not.toHaveBeenCalled();
    expect(renderPageImages).not.toHaveBeenCalled();
  });

  it("falls back to OCR when text-layer output is below the threshold and the flag is on", async () => {
    const provider = mockOcrProvider("OCR page text");
    const result = await extractPdfTextWithOcr(pdfBlob, {
      extractTextLayer: async () => "thin",
      ocrProvider: provider,
      renderPageImages: async () => ({
        totalPages: 1,
        pages: [{ image: new Blob(["page"], { type: "image/png" }), pageNumber: 1 }],
      }),
      ocrEnabled: true,
    });

    expect(result).toBe("OCR page text");
    expect(provider.recognize).toHaveBeenCalledWith(expect.any(Blob), {
      language: "eng",
      timeoutMs: 90_000,
      pageNumber: 1,
    });
  });

  it("does not fall back when OCR is disabled", async () => {
    const provider = mockOcrProvider();
    const renderPageImages = vi.fn();
    const result = await extractPdfTextWithOcr(pdfBlob, {
      extractTextLayer: async () => "thin",
      ocrProvider: provider,
      renderPageImages,
      ocrEnabled: false,
    });

    expect(result).toBe("thin");
    expect(provider.recognize).not.toHaveBeenCalled();
    expect(renderPageImages).not.toHaveBeenCalled();
  });

  it("uses environment opt-in outside direct test overrides", async () => {
    const original = process.env.CLAUSLY_OCR_ENABLED;
    process.env.CLAUSLY_OCR_ENABLED = "true";
    const provider = mockOcrProvider("env OCR");

    try {
      const result = await extractPdfTextWithOcr(pdfBlob, {
        extractTextLayer: async () => "",
        ocrProvider: provider,
        renderPageImages: async () => ({
          totalPages: 1,
          pages: [{ image: new Blob(["page"], { type: "image/png" }), pageNumber: 1 }],
        }),
      });

      expect(result).toBe("env OCR");
      expect(provider.recognize).toHaveBeenCalledOnce();
    } finally {
      if (original === undefined) {
        delete process.env.CLAUSLY_OCR_ENABLED;
      } else {
        process.env.CLAUSLY_OCR_ENABLED = original;
      }
    }
  });

  it("keeps the OCR provider mockable through dependency injection", async () => {
    const provider = mockOcrProvider("injected OCR");
    await extractPdfTextWithOcr(pdfBlob, {
      extractTextLayer: async () => "",
      ocrProvider: provider,
      renderPageImages: async () => ({
        totalPages: 1,
        pages: [{ image: "data:image/png;base64,test", pageNumber: 7 }],
      }),
      ocrEnabled: true,
      ocrTimeoutMs: 1234,
    });

    expect(provider.recognize).toHaveBeenCalledWith("data:image/png;base64,test", {
      language: "eng",
      timeoutMs: 1234,
      pageNumber: 7,
    });
  });

  it("enforces the first-20-page OCR limit and warns when the PDF is longer", async () => {
    const provider = mockOcrProvider("page");
    const warn = vi.fn();
    const pages = Array.from({ length: 25 }, (_, index) => ({
      image: new Blob([`page-${index + 1}`], { type: "image/png" }),
      pageNumber: index + 1,
    }));
    const renderPageImages = vi.fn(async (_file: Blob, options: { pageLimit: number }) => ({
      totalPages: 25,
      pages: pages.slice(0, options.pageLimit),
    }));

    await extractPdfTextWithOcr(pdfBlob, {
      extractTextLayer: async () => "",
      ocrProvider: provider,
      renderPageImages,
      warn,
      ocrEnabled: true,
    });

    expect(renderPageImages).toHaveBeenCalledWith(pdfBlob, { pageLimit: 20 });
    expect(provider.recognize).toHaveBeenCalledTimes(20);
    expect(warn).toHaveBeenCalledWith("OCR is limited to the first 20 pages; skipped 5 later pages.");
  });
});
