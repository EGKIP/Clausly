"use client";

import * as React from "react";
import { ArrowRightLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { CompareDocumentSummary } from "./types";

export function ComparePicker({ documents }: { documents: CompareDocumentSummary[] }) {
  const router = useRouter();
  const [aId, setAId] = React.useState(documents[0]?.id ?? "");
  const [bId, setBId] = React.useState(documents.find((doc) => doc.id !== aId)?.id ?? "");
  const [queryA, setQueryA] = React.useState("");
  const [queryB, setQueryB] = React.useState("");
  const selectedA = documents.find((doc) => doc.id === aId);
  const selectedB = documents.find((doc) => doc.id === bId);
  const canCompare = Boolean(aId && bId && aId !== bId);

  function compare() {
    if (!canCompare) return;
    router.push(`/dashboard/compare?a=${aId}&b=${bId}`);
  }

  if (documents.length < 2) {
    return (
      <Card className="mt-10 p-8 text-center sm:p-12">
        <p className="font-serif text-[24px] leading-tight tracking-[-0.01em]">
          Add one more contract to compare.
        </p>
        <p className="mx-auto mt-2 max-w-xl text-[13.5px] leading-relaxed text-[var(--muted)]">
          Side-by-side compare needs two analyzed documents in your portfolio.
        </p>
        <Button href="/dashboard/documents?upload=1" variant="primary" size="md" className="mt-5 min-h-11 w-full sm:w-auto">
          Upload another contract
        </Button>
      </Card>
    );
  }

  return (
    <Card className="mt-10 p-4 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-start">
        <DocumentSelector
          label="Contract A"
          value={aId}
          documents={documents}
          query={queryA}
          onQueryChange={setQueryA}
          onChange={(id) => {
            setAId(id);
            if (id === bId) setBId(documents.find((doc) => doc.id !== id)?.id ?? "");
          }}
        />
        <div className="hidden size-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] lg:flex">
          <ArrowRightLeft className="size-4" />
        </div>
        <DocumentSelector
          label="Contract B"
          value={bId}
          documents={documents.filter((doc) => doc.id !== aId)}
          query={queryB}
          onQueryChange={setQueryB}
          onChange={setBId}
          preferredType={selectedA?.type}
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12.5px] leading-relaxed text-[var(--muted)]">
          {selectedA && selectedB
            ? `Comparing ${selectedA.title} with ${selectedB.title}.`
            : "Choose two contracts to compare extracted clauses."}
        </p>
        <Button
          type="button"
          variant="primary"
          size="md"
          className="min-h-11 w-full sm:w-auto"
          disabled={!canCompare}
          onClick={compare}
        >
          Compare contracts
        </Button>
      </div>
    </Card>
  );
}

function DocumentSelector({
  label,
  value,
  documents,
  query,
  onQueryChange,
  onChange,
  preferredType,
}: {
  label: string;
  value: string;
  documents: CompareDocumentSummary[];
  query: string;
  onQueryChange: (value: string) => void;
  onChange: (value: string) => void;
  preferredType?: string;
}) {
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = documents.filter((doc) =>
      !q || `${doc.title} ${doc.party} ${doc.type}`.toLowerCase().includes(q)
    );
    return [...matches].sort((left, right) => {
      if (!preferredType) return left.title.localeCompare(right.title);
      if (left.type === preferredType && right.type !== preferredType) return -1;
      if (left.type !== preferredType && right.type === preferredType) return 1;
      return left.title.localeCompare(right.title);
    });
  }, [documents, preferredType, query]);

  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
        {label}
      </p>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--faint)]" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search contracts..."
          className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-[13.5px] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--border-strong)]"
        />
      </div>
      <div className="mt-3 grid max-h-[320px] gap-2 overflow-y-auto pr-1">
        {filtered.map((doc) => (
          <button
            key={doc.id}
            type="button"
            onClick={() => onChange(doc.id)}
            className={cn(
              "rounded-[var(--radius-md)] border px-4 py-3 text-left transition-colors",
              value === doc.id
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
            )}
          >
            <span className="block text-[13.5px] font-medium leading-tight">{doc.title}</span>
            <span className="mt-1 block text-[12px] text-[var(--muted)]">
              {doc.type} · {doc.party}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
