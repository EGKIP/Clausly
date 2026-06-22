"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, FileText, Search, X } from "lucide-react";
import type { ContractDoc } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function CompareWithButton({
  currentDocument,
  documents,
}: {
  currentDocument: ContractDoc;
  documents: ContractDoc[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const candidates = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return documents
      .filter((document) => document.id !== currentDocument.id)
      .filter((document) => {
        if (!normalizedQuery) return true;
        return [document.title, document.party, document.type, document.jurisdiction]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => {
        const leftSameType = left.type === currentDocument.type;
        const rightSameType = right.type === currentDocument.type;
        if (leftSameType !== rightSameType) return leftSameType ? -1 : 1;
        return left.title.localeCompare(right.title);
      });
  }, [currentDocument.id, currentDocument.type, documents, query]);
  const hasCandidates = documents.some((document) => document.id !== currentDocument.id);

  function selectDocument(documentId: string) {
    setOpen(false);
    router.push(`/dashboard/compare?a=${currentDocument.id}&b=${documentId}`);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Compare with another document"
        onClick={() => setOpen(true)}
        disabled={!hasCandidates}
        title={hasCandidates ? "Compare with another document" : "Upload another document to compare"}
      >
        <ArrowLeftRight className="size-3.5" /> Compare with...
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[oklch(0%_0_0/0.42)] px-3 py-4 sm:items-center sm:px-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="compare-with-title"
            className="w-full max-w-xl overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-float)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--accent-ink)]">
                  Side-by-side compare
                </p>
                <h2 id="compare-with-title" className="mt-1 font-serif text-[24px] leading-tight tracking-[-0.01em]">
                  Compare with another contract
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close compare picker"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="border-b border-[var(--border)] px-5 py-4">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--faint)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search contracts"
                  className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] pl-9 pr-3 text-[14px] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--border-strong)]"
                  autoFocus
                />
              </label>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">
                Contracts with the same type as {currentDocument.title} appear first. You can still compare any document in your portfolio.
              </p>
            </div>

            <div className="max-h-[420px] overflow-y-auto p-2">
              {candidates.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="font-serif text-[18px]">No matching contracts.</p>
                  <p className="mt-1 text-[13px] text-[var(--muted)]">
                    Try a different search or upload another document to compare.
                  </p>
                </div>
              ) : (
                candidates.map((document) => {
                  const sameType = document.type === currentDocument.type;
                  return (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => selectDocument(document.id)}
                      className="flex w-full min-w-0 items-start gap-3 rounded-[var(--radius-md)] px-3 py-3 text-left transition-colors hover:bg-[var(--surface-2)]"
                    >
                      <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent-soft)] text-[var(--accent-ink)]">
                        <FileText className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-[var(--foreground)]">
                          {document.title}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge tone="outline">{document.type}</Badge>
                          {sameType && <Badge tone="clause">Same type</Badge>}
                          <span className="text-[11.5px] text-[var(--muted)]">{document.party}</span>
                        </span>
                      </span>
                      <ArrowLeftRight
                        className={cn(
                          "mt-1 size-3.5 shrink-0",
                          sameType ? "text-[var(--accent)]" : "text-[var(--faint)]"
                        )}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
