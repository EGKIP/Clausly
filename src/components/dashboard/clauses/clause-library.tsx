"use client";

import * as React from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClauseRow } from "./clause-row";
import type { ClauseFacet, ClauseLibraryInitialFilters, ClauseLibraryItem } from "./types";
import { cn } from "@/lib/utils";

type SortValue = "newest" | "risk" | "category";

export function ClauseLibrary({
  initialClauses,
  initialNextCursor,
  totalCount,
  categoryFacets,
  riskFacets,
  initialFilters = {},
}: {
  initialClauses: ClauseLibraryItem[];
  initialNextCursor: string | null;
  totalCount: number;
  categoryFacets: ClauseFacet[];
  riskFacets: ClauseFacet[];
  initialFilters?: ClauseLibraryInitialFilters;
}) {
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [selectedRisks, setSelectedRisks] = React.useState<string[]>([]);
  const [sort, setSort] = React.useState<SortValue>("newest");
  const [clauses, setClauses] = React.useState(initialClauses);
  const [nextCursor, setNextCursor] = React.useState(initialNextCursor);
  const [count, setCount] = React.useState(totalCount);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const skipInitialFetch = React.useRef(true);
  const scopedToDocument = Boolean(initialFilters.documentId);
  const hasFilters = query.trim().length > 0 || selectedCategories.length > 0 || selectedRisks.length > 0;

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  React.useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    loadClauses({
      q: debouncedQuery,
      categories: selectedCategories,
      risks: selectedRisks,
      documentId: initialFilters.documentId,
      signal: controller.signal,
    })
      .then((payload) => {
        setClauses(payload.clauses);
        setNextCursor(payload.nextCursor);
        setCount(payload.totalCount);
      })
      .catch((loadError) => {
        if ((loadError as Error).name !== "AbortError") {
          setError("Clauses could not be loaded.");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [debouncedQuery, initialFilters.documentId, selectedCategories, selectedRisks]);

  const sortedClauses = React.useMemo(() => {
    const rows = [...clauses];
    if (sort === "newest") {
      rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sort === "risk") {
      const order: Record<string, number> = { high: 0, needs_review: 1, medium: 2, low: 3 };
      rows.sort((a, b) => order[a.riskLevel] - order[b.riskLevel] || a.title.localeCompare(b.title));
    } else {
      rows.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
    }
    return rows;
  }, [clauses, sort]);

  const loadMore = React.useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const payload = await loadClauses({
        q: debouncedQuery,
        categories: selectedCategories,
        risks: selectedRisks,
        documentId: initialFilters.documentId,
        cursor: nextCursor,
      });
      setClauses((current) => mergeClauses(current, payload.clauses));
      setNextCursor(payload.nextCursor);
      setCount(payload.totalCount);
    } catch {
      setError("More clauses could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  }, [debouncedQuery, initialFilters.documentId, loadingMore, nextCursor, selectedCategories, selectedRisks]);

  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextCursor || loading || loadingMore || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "240px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, loading, loadingMore, nextCursor]);

  function toggleCategory(value: string) {
    setSelectedCategories((current) => toggleValue(current, value));
  }

  function toggleRisk(value: string) {
    setSelectedRisks((current) => toggleValue(current, value));
  }

  function clearFilters() {
    setQuery("");
    setDebouncedQuery("");
    setSelectedCategories([]);
    setSelectedRisks([]);
  }

  if (initialClauses.length === 0 && !hasFilters) {
    return (
      <div className="mt-10 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 text-center sm:p-12">
        <p className="font-serif text-[24px] leading-tight tracking-[-0.01em]">
          No clauses found yet.
        </p>
        <p className="mx-auto mt-2 max-w-xl text-[13.5px] leading-relaxed text-[var(--muted)]">
          {scopedToDocument
            ? "This document does not have extracted clauses yet."
            : "Upload and analyze a document, then Clausly will collect extracted clauses here."}
        </p>
        <Button href="/dashboard/documents?upload=1" variant="primary" size="md" className="mt-5 min-h-11 w-full sm:w-auto">
          Upload a contract
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-[440px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--faint)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, quote, plain English..."
              className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-[13.5px] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--border-strong)]"
            />
          </div>
          <label className="relative w-full lg:w-[190px]">
            <span className="sr-only">Sort clauses</span>
            <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--faint)]" />
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortValue)}
              className="h-11 w-full appearance-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] pl-9 pr-9 text-[13.5px] outline-none transition-colors focus:border-[var(--border-strong)]"
            >
              <option value="newest">Newest</option>
              <option value="risk">Risk desc</option>
              <option value="category">Category</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--faint)]" />
          </label>
        </div>

        <div className="mt-4 grid gap-3">
          <FacetGroup
            label="Category"
            facets={categoryFacets}
            selected={selectedCategories}
            onToggle={toggleCategory}
          />
          <FacetGroup
            label="Risk"
            facets={riskFacets}
            selected={selectedRisks}
            onToggle={toggleRisk}
          />
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-[12.5px] text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X className="size-3.5" />
            Clear filters
          </button>
        )}
      </div>

      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]">
        Showing {sortedClauses.length} of {count}
      </p>

      {error && (
        <p className="mt-4 rounded-[var(--radius-sm)] border border-[color-mix(in_oklch,var(--color-coral)_28%,var(--border))] bg-[var(--color-coral-soft)] px-3 py-2 text-[12.5px] text-[var(--color-coral-ink)]">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-4 grid gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-40 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]"
            />
          ))}
        </div>
      ) : sortedClauses.length === 0 ? (
        <div className="mt-10 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 text-center sm:p-12">
          <p className="font-serif text-[24px] leading-tight tracking-[-0.01em]">
            No matching clauses.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-[13.5px] leading-relaxed text-[var(--muted)]">
            Try a broader search or clear one of the filters.
          </p>
          <Button variant="outline" size="md" className="mt-5 min-h-11 w-full sm:w-auto" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {sortedClauses.map((clause) => (
            <ClauseRow key={clause.id} clause={clause} />
          ))}
        </div>
      )}

      {nextCursor && !loading && (
        <>
          <div ref={sentinelRef} className="h-8" aria-hidden />
          <div className="mt-2 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : "Load more clauses"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function FacetGroup({
  label,
  facets,
  selected,
  onToggle,
}: {
  label: string;
  facets: ClauseFacet[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (facets.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <p className="w-20 shrink-0 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {facets.map((facet) => {
          const active = selected.includes(facet.value);
          return (
            <button
              key={facet.value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(facet.value)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-3 py-1.5 text-[12px] transition-colors sm:min-h-0",
                active
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-[var(--border-strong)]"
              )}
            >
              {facet.label} · {facet.count}
            </button>
          );
        })}
      </div>
    </div>
  );
}

async function loadClauses({
  q,
  categories,
  risks,
  documentId,
  cursor,
  signal,
}: {
  q: string;
  categories: string[];
  risks: string[];
  documentId?: string;
  cursor?: string;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (categories.length > 0) params.set("category", categories.join(","));
  if (risks.length > 0) params.set("risk", risks.join(","));
  if (documentId) params.set("documentId", documentId);
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`/api/clauses?${params.toString()}`, { signal });
  if (!response.ok) throw new Error("Clause request failed.");
  return response.json() as Promise<{
    clauses: ClauseLibraryItem[];
    nextCursor: string | null;
    totalCount: number;
  }>;
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function mergeClauses(current: ClauseLibraryItem[], incoming: ClauseLibraryItem[]) {
  const seen = new Set(current.map((clause) => clause.id));
  return [...current, ...incoming.filter((clause) => !seen.has(clause.id))];
}
