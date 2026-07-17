"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Search,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Upload,
  X,
  ChevronDown,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import type { DocType } from "@/lib/mock-data";
import { useDocuments } from "@/lib/hooks/use-documents";
import { DocumentCard, DocumentRow } from "@/components/dashboard/document-card";
import { PortfolioEmptyState } from "@/components/dashboard/empty-states/portfolio-empty";
import type { RiskLevel } from "@/components/ui/risk-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const docTypes: ("All" | DocType)[] = [
  "All",
  "Lease",
  "Insurance",
  "Employment",
  "Service",
  "Subscription",
  "Loan",
  "NDA",
];
const riskLevels: ("All risk" | RiskLevel)[] = [
  "All risk",
  "Low",
  "Medium",
  "High",
  "Needs Review",
];

export default function DocumentsPage() {
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<(typeof docTypes)[number]>("All");
  const [risk, setRisk] = React.useState<(typeof riskLevels)[number]>("All risk");
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [sort, setSort] = React.useState<"recent" | "ends" | "risk">("recent");
  const { documents, isLoading, error } = useDocuments();

  const filtered = React.useMemo(() => {
    const r = documents.filter((d) => {
      const q1 = q.trim().toLowerCase();
      const matchQ = !q1 || (d.title + " " + d.party + " " + d.tags.join(" ")).toLowerCase().includes(q1);
      const matchT = type === "All" || d.type === type;
      const matchR = risk === "All risk" || d.risk === risk;
      return matchQ && matchT && matchR;
    });
    if (sort === "recent") r.sort((a, b) => a.uploadedDaysAgo - b.uploadedDaysAgo);
    if (sort === "ends") r.sort((a, b) => +new Date(a.ends || 0) - +new Date(b.ends || 0));
    if (sort === "risk") {
      const order: Record<RiskLevel, number> = { High: 0, "Needs Review": 1, Medium: 2, Low: 3 };
      r.sort((a, b) => order[a.risk] - order[b.risk]);
    }
    return r;
  }, [documents, q, type, risk, sort]);

  const hasFilters = q !== "" || type !== "All" || risk !== "All risk";
  const portfolioEmpty = !isLoading && !error && documents.length === 0;
  const resultSummary = isLoading
    ? "Loading your portfolio"
    : `${filtered.length} ${filtered.length === 1 ? "document" : "documents"} shown`;
  const activeFilters = [
    q.trim() ? `Search: “${q.trim()}”` : null,
    type !== "All" ? `Type: ${type}` : null,
    risk !== "All risk" ? `Risk: ${risk}` : null,
  ].filter((filter): filter is string => Boolean(filter));

  if (portfolioEmpty) {
    return (
      <PageBody>
        <PortfolioEmptyState variant="documents" />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow="Your portfolio"
        title="Documents"
        description="Everything you've uploaded. Filter by type or risk, search by party or clause."
        actions={
          <Button variant="primary" size="md" href="/dashboard/documents?upload=1" className="min-h-11">
            <Upload className="size-3.5" /> Upload
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-[1_0_100%] sm:flex-1 sm:min-w-[200px] sm:max-w-[420px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--faint)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, party, tag…"
            className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-[13.5px] placeholder:text-[var(--faint)] focus:outline-none focus:border-[var(--border-strong)]"
          />
        </div>

        <FilterChip
          label={type === "All" ? "All types" : type}
          options={[...docTypes]}
          value={type}
          onChange={(v) => setType(v as typeof type)}
        />
        <FilterChip
          label={risk}
          options={[...riskLevels]}
          value={risk}
          onChange={(v) => setRisk(v as typeof risk)}
        />
        <FilterChip
          label={`Sort: ${sort === "recent" ? "Recent" : sort === "ends" ? "Ends soonest" : "Highest risk"}`}
          icon={SlidersHorizontal}
          options={[
            { label: "Most recent", value: "recent" },
            { label: "Ends soonest", value: "ends" },
            { label: "Highest risk", value: "risk" },
          ]}
          value={sort}
          onChange={(v) => setSort(v as typeof sort)}
        />

        {hasFilters && (
          <button
            onClick={() => {
              setQ("");
              setType("All");
              setRisk("All risk");
            }}
            className="inline-flex min-h-11 items-center gap-1.5 px-2 text-[12.5px] text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X className="size-3.5" /> Clear
          </button>
        )}

        <div className="ml-auto inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-0.5">
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-label={v}
              className={cn(
                "inline-flex size-10 sm:size-8 items-center justify-center rounded-[var(--radius-xs)] transition-colors",
                view === v
                  ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                  : "text-[var(--faint)] hover:text-[var(--foreground)]"
              )}
            >
              {v === "grid" ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--border)] py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]">
          {resultSummary} · {documents.length} total
        </p>
        {activeFilters.length > 0 && (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {activeFilters.map((filter) => (
              <span
                key={filter}
                className="rounded-[var(--radius-xs)] bg-[var(--surface-2)] px-2 py-1 text-[11.5px] text-[var(--muted)]"
              >
                {filter}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : filtered.length === 0 ? (
        <EmptyState onClear={() => { setQ(""); setType("All"); setRisk("All risk"); }} />
      ) : view === "grid" ? (
        <div data-tour="documents" className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: Math.min(i, 8) * 0.04, ease: [0.165, 0.84, 0.44, 1] }}
            >
              <DocumentCard doc={d} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div data-tour="documents" className="mt-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="hidden md:grid grid-cols-[2.6fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-2)] font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
            <span>Document</span>
            <span>Ends</span>
            <span>Jurisdiction</span>
            <span>Risk</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {filtered.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: Math.min(i, 10) * 0.025, ease: [0.165, 0.84, 0.44, 1] }}
              >
                <DocumentRow doc={d} />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </PageBody>
  );
}

function LoadingState() {
  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <Skeleton variant="block" className="size-10" />
            <Skeleton variant="pill" className="w-16 h-5" />
          </div>
          <Skeleton className="mt-5 h-5 w-4/5" />
          <Skeleton className="mt-2 h-3 w-1/3" />
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
          <div className="mt-4 flex gap-1.5">
            <Skeleton variant="pill" className="w-14 h-5" />
            <Skeleton variant="pill" className="w-12 h-5" />
            <Skeleton variant="pill" className="w-16 h-5" />
          </div>
          <div className="mt-5 pt-4 border-t border-[var(--border)] flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="mt-10 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-12 text-center">
      <p className="font-serif text-[22px] leading-tight tracking-[-0.01em]">
        Documents could not load.
      </p>
      <p className="mt-2 text-[13px] text-[var(--muted)]">{message}</p>
    </div>
  );
}

/* ── Lightweight filter chip dropdown ───────────────────────────────── */
type Option = string | { label: string; value: string };
function FilterChip({
  label,
  options,
  value,
  onChange,
  icon: Icon,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div ref={ref} className="relative max-w-full">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-11 max-w-[calc(100vw-2rem)] items-center gap-1.5 rounded-[var(--radius-sm)] border px-3 text-[13px] font-medium transition-colors sm:h-10",
          open
            ? "border-[var(--border-strong)] bg-[var(--surface-2)]"
            : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
        )}
      >
        {Icon && <Icon className="size-3.5 text-[var(--muted)]" />}
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3.5 text-[var(--faint)]" />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-[min(220px,calc(100vw-2rem))] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-float)] sm:left-auto sm:right-0">
          {options.map((opt) => {
            const o = typeof opt === "string" ? { label: opt, value: opt } : opt;
            const active = o.value === value;
            return (
              <button
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between gap-3 rounded-[var(--radius-xs)] px-2.5 py-2 text-left text-[13px] hover:bg-[var(--surface-2)] sm:min-h-0 sm:py-1.5",
                  active && "bg-[var(--surface-2)] text-[var(--foreground)]"
                )}
              >
                {o.label}
                {active && <span className="size-1.5 rounded-full bg-[var(--accent)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="mt-10 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-12 text-center">
      <p className="font-serif text-[22px] leading-tight tracking-[-0.01em]">
        No documents match those filters.
      </p>
      <p className="mt-2 text-[13px] text-[var(--muted)]">
        Try widening the filters, or clear them to see everything.
      </p>
      <Button variant="secondary" size="md" onClick={onClear} className="mt-5 min-h-11 w-full sm:w-auto">
        Clear filters
      </Button>
    </div>
  );
}
