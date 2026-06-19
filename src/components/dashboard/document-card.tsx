"use client";

import Link from "next/link";
import { FileText, CalendarClock, MoreHorizontal } from "lucide-react";
import { RiskPill } from "@/components/ui/risk-pill";
import { Badge } from "@/components/ui/primitives";
import type { ContractDoc } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

/* Card variant for a document — used in grid views. */
export function DocumentCard({
  doc,
  className,
}: {
  doc: ContractDoc;
  className?: string;
}) {
  return (
    <Link
      href={`/dashboard/documents/${doc.id}`}
      className={cn(
        "group relative flex flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-[2px] hover:shadow-[var(--shadow-card)] hover:border-[var(--border-strong)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="inline-flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)]">
          <FileText className="size-4 text-[var(--muted)]" />
        </div>
        <RiskPill level={doc.risk} size="sm" />
      </div>

      <h3 className="mt-4 font-serif text-[18px] leading-[1.2] tracking-[-0.005em] line-clamp-2">
        {doc.title}
      </h3>
      <p className="mt-1 text-[12.5px] text-[var(--muted)] truncate">{doc.party}</p>

      <p className="mt-3 text-[13px] leading-snug text-[var(--muted)] line-clamp-2">
        {doc.summary}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge tone="outline">{doc.type}</Badge>
        {doc.jurisdiction !== "—" && <Badge tone="outline">{doc.jurisdiction}</Badge>}
        <Badge tone="outline">{doc.pages} pages</Badge>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-[11.5px] font-mono text-[var(--muted)]">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <CalendarClock className="size-3 shrink-0" />
          <span className="truncate">
          Ends {doc.ends}
          </span>
        </span>
        <span
          className="size-7 inline-flex items-center justify-center rounded-[var(--radius-xs)] opacity-0 group-hover:opacity-100 transition-opacity"
          aria-hidden
        >
          <MoreHorizontal className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}

/* Row variant for a document — used in list views. */
export function DocumentRow({ doc }: { doc: ContractDoc }) {
  return (
    <Link
      href={`/dashboard/documents/${doc.id}`}
      className="grid grid-cols-[1fr_auto] md:grid-cols-[2.6fr_1fr_1fr_auto] items-center gap-4 px-5 py-4 hover:bg-[var(--surface-2)] transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)]">
          <FileText className="size-4 text-[var(--muted)]" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium leading-tight">{doc.title}</p>
          <p className="truncate text-[12px] text-[var(--muted)]">
            {doc.type} · {doc.party}
          </p>
        </div>
      </div>
      <div className="hidden md:block text-[12.5px] text-[var(--muted)] font-mono tabular-nums">
        {doc.ends}
      </div>
      <div className="hidden md:block text-[12px] text-[var(--muted)]">
        {doc.jurisdiction}
      </div>
      <div className="flex items-center gap-2">
        <RiskPill level={doc.risk} size="sm" />
      </div>
    </Link>
  );
}
