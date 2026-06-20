import { ArrowUpRight, BookOpen, FileText } from "lucide-react";
import Link from "next/link";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { RiskPill } from "@/components/ui/risk-pill";
import type { ClauseLibraryItem } from "./types";

export function ClauseRow({ clause }: { clause: ClauseLibraryItem }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="clause">
              <BookOpen className="size-2.5" />
              {clause.category}
            </Badge>
            <RiskPill level={clause.risk} size="sm" />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
              Page {clause.page}
            </span>
          </div>

          <h2 className="mt-3 font-serif text-[22px] leading-tight tracking-[-0.01em]">
            {clause.title}
          </h2>
          <Link
            href={`/dashboard/documents/${clause.documentId}`}
            className="mt-2 inline-flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">{clause.documentTitle}</span>
            <ArrowUpRight className="size-3 shrink-0" />
          </Link>

          <blockquote className="mt-4 line-clamp-3 border-l border-[var(--border-strong)] pl-3 text-[13px] leading-relaxed text-[var(--muted)]">
            &ldquo;{clause.sourceQuote}&rdquo;
          </blockquote>
          <p className="mt-3 line-clamp-2 text-[13.5px] leading-relaxed text-[var(--foreground)]">
            {clause.plainEnglish}
          </p>
        </div>

        <Button
          href={`/dashboard/documents/${clause.documentId}?clause=${clause.id}`}
          variant="outline"
          size="sm"
          className="min-h-11 w-full shrink-0 md:w-auto"
        >
          View in document
          <ArrowUpRight className="size-3.5" />
        </Button>
      </div>
    </Card>
  );
}
