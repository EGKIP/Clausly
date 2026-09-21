import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    cleanup();
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

  it("discards a stale load-more response instead of merging it into a newly filtered list", async () => {
    let resolveStaleLoadMore: (() => void) | undefined;
    const staleLoadMoreGate = new Promise<void>((resolve) => {
      resolveStaleLoadMore = resolve;
    });

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("cursor=cursor-1")) {
        await staleLoadMoreGate;
        return {
          ok: true,
          json: async () => ({
            clauses: [{ ...baseClause, id: "clause-stale", title: "Stale merged clause" }],
            nextCursor: null,
            totalCount: 2,
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          clauses: [{ ...baseClause, id: "clause-fresh", title: "Fresh filtered clause" }],
          nextCursor: null,
          totalCount: 1,
        }),
      };
    }));

    render(
      <ClauseLibrary
        initialClauses={[baseClause]}
        initialNextCursor="cursor-1"
        totalCount={2}
        categoryFacets={[{ value: "Termination", label: "Termination", count: 1 }]}
        riskFacets={[{ value: "high", label: "High", count: 1 }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Load more clauses" }));
    await act(async () => {
      await flushPromises();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "High · 1" })[0]);
    await act(async () => {
      await flushPromises();
    });

    expect(screen.getByText("Fresh filtered clause")).toBeInTheDocument();

    resolveStaleLoadMore?.();
    await act(async () => {
      await flushPromises();
    });

    expect(screen.queryByText("Stale merged clause")).not.toBeInTheDocument();
    expect(screen.getByText("Fresh filtered clause")).toBeInTheDocument();
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
