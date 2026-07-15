import { describe, expect, it } from "vitest";
import { categorizeAnalysisError, FAILURE_CATEGORY_COPY } from "../failure-categories";
import { NoTextLayerError, ProviderSchemaError } from "../errors";

describe("categorizeAnalysisError", () => {
  it("buckets a timeout error", () => {
    expect(categorizeAnalysisError(new Error("PDF text extraction timed out."))).toBe("extraction_timeout");
    expect(categorizeAnalysisError(new Error("OCR timed out after 90000ms on page 3."))).toBe("extraction_timeout");
  });

  it("buckets a NoTextLayerError regardless of its message", () => {
    expect(categorizeAnalysisError(new NoTextLayerError("PDF text extraction returned no text. OCR is disabled."))).toBe("no_text");
    expect(categorizeAnalysisError(new NoTextLayerError("PDF OCR fallback returned no text."))).toBe("no_text");
  });

  it("buckets a ProviderSchemaError as a provider error", () => {
    const error = new ProviderSchemaError("OpenAI", "documentType: Invalid input");
    expect(categorizeAnalysisError(error)).toBe("provider_error");
  });

  it("buckets a storage/download error", () => {
    expect(categorizeAnalysisError(new Error("Document file could not be downloaded."))).toBe("storage_error");
  });

  it("falls back to unknown for unrecognized errors", () => {
    expect(categorizeAnalysisError(new Error("Something else went wrong."))).toBe("unknown");
    expect(categorizeAnalysisError("a raw string error")).toBe("unknown");
  });
});

describe("FAILURE_CATEGORY_COPY", () => {
  it("has friendly copy for every category", () => {
    const categories: Array<keyof typeof FAILURE_CATEGORY_COPY> = [
      "unsupported_file",
      "storage_error",
      "extraction_timeout",
      "no_text",
      "provider_error",
      "stuck_timeout",
      "unknown",
    ];

    for (const category of categories) {
      expect(FAILURE_CATEGORY_COPY[category].title.length).toBeGreaterThan(0);
      expect(FAILURE_CATEGORY_COPY[category].message.length).toBeGreaterThan(0);
    }
  });
});
