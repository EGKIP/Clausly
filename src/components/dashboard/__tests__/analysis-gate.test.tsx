import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalysisGate } from "../analysis-gate";
import { FAILURE_CATEGORY_COPY } from "@/lib/ai/failure-categories";
import { DOCUMENTS_CHANGED_EVENT } from "@/lib/hooks/use-documents";

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

  it("escalates the analyzing copy the longer it takes", () => {
    vi.useFakeTimers();
    try {
      render(
        <AnalysisGate documentId="doc-1" initialStatus="analyzing" initialErrorMessage={null} initialFailureCategory={null}>
          <div>Document content</div>
        </AnalysisGate>
      );

      expect(screen.queryByText(/taking a little longer/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/safe to leave this page/i)).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(20_000);
      });
      expect(screen.getByText(/taking a little longer/i)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(70_000);
      });
      expect(screen.getByText(/safe to leave this page/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("notifies other mounted document lists once analysis finishes", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ status: "ready", errorMessage: null, failureCategory: null }), {
            status: 200,
          })
      );
      vi.stubGlobal("fetch", fetchMock);
      const handleChange = vi.fn();
      window.addEventListener(DOCUMENTS_CHANGED_EVENT, handleChange);

      render(
        <AnalysisGate documentId="doc-1" initialStatus="analyzing" initialErrorMessage={null} initialFailureCategory={null}>
          <div>Document content</div>
        </AnalysisGate>
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });

      expect(handleChange).toHaveBeenCalledOnce();
      window.removeEventListener(DOCUMENTS_CHANGED_EVENT, handleChange);
    } finally {
      vi.useRealTimers();
    }
  });
});
