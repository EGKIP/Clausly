"use client";

import * as React from "react";
import { ArrowRightLeft, FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { RiskPill } from "@/components/ui/risk-pill";
import type { TextDiffSegment } from "@/lib/ai/compare/diff";
import type { Clause } from "@/lib/db/types";
import type { ComparePair, CompareResponse } from "./types";
import { cn } from "@/lib/utils";

export function CompareView({ aId, bId }: { aId: string; bId: string }) {
  const router = useRouter();
  const [comparison, setComparison] = React.useState<CompareResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [onlyDifferences, setOnlyDifferences] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/compare?a=${aId}&b=${bId}`)
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error ?? "Comparison could not be loaded.");
        return body as CompareResponse;
      })
      .then((body) => {
        if (!cancelled) setComparison(body);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Comparison could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [aId, bId]);

  function swap() {
    router.push(`/dashboard/compare?a=${bId}&b=${aId}`);
  }

  if (loading) {
    return (
      <Card className="mt-10 p-6">
        <div className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
          <Loader2 className="size-4 motion-safe:animate-spin" />
          Comparing extracted clauses...
        </div>
      </Card>
    );
  }

  if (error || !comparison) {
    return (
      <Card className="mt-10 p-6">
        <p className="font-serif text-[22px] leading-tight tracking-[-0.01em]">
          Compare could not load.
        </p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--muted)]">
          {error ?? "Try again from the document detail page."}
        </p>
      </Card>
    );
  }

  const visiblePairs = onlyDifferences
    ? comparison.pairs.filter(hasDifference)
    : comparison.pairs;

  return (
    <div className="mt-10">
      <div className="sticky top-16 z-20 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_92%,transparent)] p-4 shadow-[var(--shadow-card)] backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
            <DocumentHeader label="A" title={comparison.a.title} />
            <ArrowRightLeft className="hidden size-4 text-[var(--faint)] lg:block" />
            <DocumentHeader label="B" title={comparison.b.title} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant={onlyDifferences ? "primary" : "outline"}
              size="sm"
              className="min-h-11 w-full sm:min-h-0 sm:w-auto"
              onClick={() => setOnlyDifferences((value) => !value)}
            >
              {onlyDifferences ? "Show all" : "Only differences"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11 w-full sm:min-h-0 sm:w-auto"
              onClick={swap}
            >
              <ArrowRightLeft className="size-3.5" />
              Swap
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        {visiblePairs.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="font-serif text-[22px] leading-tight tracking-[-0.01em]">
              No differences in the loaded clause pairs.
            </p>
          </Card>
        ) : visiblePairs.map((pair, index) => (
          <ComparePairRow key={`${pair.aClause?.id ?? "none"}-${pair.bClause?.id ?? "none"}-${index}`} pair={pair} />
        ))}
      </div>
    </div>
  );
}

function DocumentHeader({ label, title }: { label: "A" | "B"; title: string }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">
        Contract {label}
      </p>
      <p className="mt-1 truncate text-[13.5px] font-medium">{title}</p>
    </div>
  );
}

function ComparePairRow({ pair }: { pair: ComparePair }) {
  const changed = hasDifference(pair);
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone={changed ? "ember" : "clause"}>
            {changed ? "Different" : "Aligned"}
          </Badge>
          {pair.similarity !== null && (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
              Similarity {(pair.similarity * 100).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2">
        <ClausePane label="A" clause={pair.aClause} diff={pair.diff} side="a" />
        <ClausePane label="B" clause={pair.bClause} diff={pair.diff} side="b" />
      </div>
    </Card>
  );
}

function ClausePane({
  label,
  clause,
  diff,
  side,
}: {
  label: "A" | "B";
  clause?: Clause;
  diff?: TextDiffSegment[];
  side: "a" | "b";
}) {
  if (!clause) {
    return (
      <div className="min-h-48 border-t border-[var(--border)] p-4 lg:border-t-0 lg:border-l">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">
          Contract {label}
        </p>
        <div className="mt-4 rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-4 text-[13px] text-[var(--muted)]">
          Not present in {label}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-48 border-t border-[var(--border)] p-4 lg:border-t-0", side === "b" && "lg:border-l")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">
          Contract {label}
        </p>
        <RiskPill level={riskLabel(clause.riskLevel)} size="sm" />
      </div>
      <h2 className="mt-3 font-serif text-[20px] leading-tight tracking-[-0.01em]">
        {clause.title}
      </h2>
      <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
        <FileText className="size-3" />
        {clause.category} · page {clause.page}
      </p>
      <p className="mt-4 text-[13.5px] leading-relaxed">
        {diff && side === "a" ? renderDiff(diff, "remove") : diff && side === "b" ? renderDiff(diff, "add") : clause.sourceQuote}
      </p>
      <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--muted)]">
        {clause.plainEnglish}
      </p>
    </div>
  );
}

function renderDiff(diff: TextDiffSegment[], activeType: "add" | "remove") {
  return diff
    .filter((part) => part.type === "equal" || part.type === activeType)
    .map((part, index) => (
      <span
        key={`${part.type}-${index}`}
        className={part.type === "equal"
          ? undefined
          : activeType === "add"
            ? "rounded-[3px] bg-[var(--color-clause-soft)] text-[var(--color-clause-ink)]"
            : "rounded-[3px] bg-[var(--color-coral-soft)] text-[var(--color-coral-ink)] line-through"}
      >
        {part.value}
      </span>
    ));
}

function hasDifference(pair: ComparePair) {
  if (!pair.aClause || !pair.bClause) return true;
  return pair.diff?.some((part) => part.type !== "equal") ?? false;
}

function riskLabel(riskLevel: Clause["riskLevel"]) {
  if (riskLevel === "low") return "Low";
  if (riskLevel === "medium") return "Medium";
  if (riskLevel === "high") return "High";
  return "Needs Review";
}
