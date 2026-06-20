"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { ClauseRow } from "./clause-row";
import type { ClauseFacet, ClauseLibraryInitialFilters, ClauseLibraryItem } from "./types";

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
  const scopedToDocument = Boolean(initialFilters.documentId);

  if (initialClauses.length === 0) {
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
              Library controls
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {categoryFacets.slice(0, 6).map((facet) => (
                <Badge key={facet.value} tone="outline">
                  {facet.label} · {facet.count}
                </Badge>
              ))}
              {riskFacets.map((facet) => (
                <Badge key={facet.value} tone={facet.value === "high" ? "coral" : "outline"}>
                  {facet.label} · {facet.count}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]">
        Showing {initialClauses.length} of {totalCount}
      </p>

      <div className="mt-4 grid gap-3">
        {initialClauses.map((clause) => (
          <ClauseRow key={clause.id} clause={clause} />
        ))}
      </div>

      {initialNextCursor && (
        <div className="mt-6 rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-center text-[12.5px] text-[var(--muted)]">
          More clauses are available. Infinite scroll lands in the next phase.
        </div>
      )}
    </div>
  );
}
