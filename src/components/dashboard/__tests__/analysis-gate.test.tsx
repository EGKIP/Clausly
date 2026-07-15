import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalysisGate } from "../analysis-gate";
import { FAILURE_CATEGORY_COPY } from "@/lib/ai/failure-categories";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AnalysisGate", () => {
  it("renders children when the document is ready", () => {
    render(
      <AnalysisGate documentId="doc-1" initialStatus="ready" initialErrorMessage={null} initialFailureCategory={null}>
        <div>Document content</div>
      </AnalysisGate>
    );

    expect(screen.getByText("Document content")).toBeInTheDocument();
  });

  it("shows category-specific copy for a known failure category", () => {
    render(
      <AnalysisGate
        documentId="doc-1"
        initialStatus="failed"
        initialErrorMessage="PDF text extraction timed out."
        initialFailureCategory="extraction_timeout"
      >
        <div>Document content</div>
      </AnalysisGate>
    );

    expect(screen.getByText(FAILURE_CATEGORY_COPY.extraction_timeout.title)).toBeInTheDocument();
    expect(screen.getByText(FAILURE_CATEGORY_COPY.extraction_timeout.message)).toBeInTheDocument();
    // The category copy is specific enough that the generic fallback hint shouldn't also show.
    expect(screen.queryByText(/Common causes:/)).not.toBeInTheDocument();
  });

  it("falls back to generic copy when no failure category is known", () => {
    render(
      <AnalysisGate
        documentId="doc-1"
        initialStatus="failed"
        initialErrorMessage="Some technical failure detail"
        initialFailureCategory={null}
      >
        <div>Document content</div>
      </AnalysisGate>
    );

    expect(screen.getByText("We couldn't read this contract.")).toBeInTheDocument();
    expect(screen.getByText("Some technical failure detail")).toBeInTheDocument();
    expect(screen.getByText(/Common causes:/)).toBeInTheDocument();
  });

  it("retries analysis and switches back to the analyzing view", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AnalysisGate
        documentId="doc-1"
        initialStatus="failed"
        initialErrorMessage="boom"
        initialFailureCategory="unknown"
      >
        <div>Document content</div>
      </AnalysisGate>
    );

    fireEvent.click(screen.getByRole("button", { name: /re-analyze/i }));

    await waitFor(() => expect(screen.getByText("Reading your contract.")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/documents/doc-1/reanalyze", { method: "POST" });
  });
});
