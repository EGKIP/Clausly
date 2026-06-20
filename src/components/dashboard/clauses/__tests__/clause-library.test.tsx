import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClauseLibrary } from "../clause-library";
import type { ClauseLibraryItem } from "../types";

const baseClause: ClauseLibraryItem = {
  id: "clause-1",
  documentId: "doc-1",
  documentTitle: "Greenfield Lease",
  title: "Termination fee",
  category: "Termination",
  risk: "High",
  riskLevel: "high",
  page: 4,
  sourceQuote: "Tenant may terminate early only after paying a fee.",
  plainEnglish: "Leaving early costs extra.",
  createdAt: "2026-06-01T00:00:00.000Z",
};

describe("ClauseLibrary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        clauses: [{ ...baseClause, id: "clause-2", title: "Termination notice" }],
        nextCursor: null,
        totalCount: 1,
      }),
    })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("debounces search before fetching filtered clauses", async () => {
    renderLibrary();

    fireEvent.change(screen.getByPlaceholderText("Search title, quote, plain English..."), {
      target: { value: "termination" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(199);
    });
    expect(fetch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
      await flushPromises();
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("q=termination");
    await act(async () => {
      await flushPromises();
    });
    expect(screen.getByText("Termination notice")).toBeInTheDocument();
  });

  it("toggles risk filters and requests the matching API filter", async () => {
    renderLibrary();

    fireEvent.click(screen.getAllByRole("button", { name: "High · 1" })[0]);

    await act(async () => {
      await flushPromises();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("risk=high");
  });

  it("renders an empty state when there are no extracted clauses", () => {
    render(
      <ClauseLibrary
        initialClauses={[]}
        initialNextCursor={null}
        totalCount={0}
        categoryFacets={[]}
        riskFacets={[]}
      />
    );

    expect(screen.getByText("No clauses found yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upload a contract/i })).toHaveAttribute("href", "/dashboard/documents?upload=1");
  });
});

function renderLibrary() {
  render(
    <ClauseLibrary
      initialClauses={[baseClause]}
      initialNextCursor={null}
      totalCount={1}
      categoryFacets={[{ value: "Termination", label: "Termination", count: 1 }]}
      riskFacets={[{ value: "high", label: "High", count: 1 }]}
    />
  );
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}
