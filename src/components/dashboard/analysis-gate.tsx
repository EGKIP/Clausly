"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DocumentStatus } from "@/lib/db/types";
import { useDocumentStatusPoll } from "@/lib/hooks/use-document";

/* Branches the document detail page rendering on the document.status field.
 * - ready   → renders children (the real DocumentView)
 * - pending → same skeleton as analyzing; we treat it as "just queued"
 * - analyzing → skeleton + polling, refresh server data when status flips
 * - failed  → error card with retry placeholder (analyze route lands in track N) */
export function AnalysisGate({
  documentId,
  initialStatus,
  initialErrorMessage,
  children,
}: {
  documentId: string;
  initialStatus: DocumentStatus;
  initialErrorMessage: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { status, errorMessage } = useDocumentStatusPoll(documentId, initialStatus, {
    enabled: initialStatus === "analyzing" || initialStatus === "pending",
  });

  /* When the analysis completes (or fails), refetch the server component so
   * the detail page hydrates with the freshly-persisted clauses/dates. */
  React.useEffect(() => {
    if (status !== initialStatus && (status === "ready" || status === "failed")) {
      router.refresh();
    }
  }, [router, status, initialStatus]);

  if (status === "ready") return <>{children}</>;
  if (status === "failed") {
    return <FailedState message={errorMessage ?? initialErrorMessage} />;
  }
  return <AnalyzingState />;
}

function AnalyzingState() {
  return (
    <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-8 md:p-10">
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 text-[var(--accent)]" />
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--accent-ink)]">
          Analyzing
        </p>
      </div>
      <h2 className="mt-3 font-serif text-[clamp(1.4rem,2vw,1.8rem)] leading-tight tracking-[-0.01em]">
        Reading your contract.
      </h2>
      <p className="mt-2 max-w-xl text-[14px] text-[var(--muted)]">
        Clausly is extracting clauses, dates, and risks. This usually takes a few seconds.
        We&apos;ll refresh the page automatically when it&apos;s done.
      </p>

      <div className="mt-7 flex items-center gap-2 text-[12px] text-[var(--faint)]">
        <Loader2 className="size-3.5 animate-spin text-[var(--accent)]" />
        <span>Working…</span>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_minmax(0,520px)]">
        <div className="space-y-3">
          <SkeletonBlock heightClass="h-7" widthClass="w-2/3" />
          <SkeletonBlock heightClass="h-4" widthClass="w-full" />
          <SkeletonBlock heightClass="h-4" widthClass="w-11/12" />
          <SkeletonBlock heightClass="h-4" widthClass="w-9/12" />
          <div className="grid grid-cols-3 gap-2.5 pt-3">
            <SkeletonBlock heightClass="h-20" widthClass="w-full" />
            <SkeletonBlock heightClass="h-20" widthClass="w-full" />
            <SkeletonBlock heightClass="h-20" widthClass="w-full" />
          </div>
        </div>
        <SkeletonBlock heightClass="aspect-[8.5/11]" widthClass="w-full max-w-[520px] mx-auto" />
      </div>
    </div>
  );
}

function FailedState({ message }: { message: string | null }) {
  return (
    <div className="mt-8 rounded-[var(--radius-lg)] border border-[color-mix(in_oklch,var(--color-coral)_25%,var(--border))] bg-[var(--color-coral-soft)] p-8 md:p-10">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface)] text-[var(--color-coral-ink)] shrink-0">
          <AlertTriangle className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--color-coral-ink)]">
            Analysis failed
          </p>
          <h2 className="mt-2 font-serif text-[clamp(1.3rem,1.9vw,1.7rem)] leading-tight tracking-[-0.01em] text-[var(--foreground)]">
            We couldn&apos;t read this contract.
          </h2>
          <p className="mt-2 max-w-xl text-[13.5px] text-[var(--foreground)] opacity-80">
            {message ?? "An unexpected error stopped the analysis. The original file is safe and still in your library."}
          </p>
          <p className="mt-3 text-[12px] text-[var(--muted)]">
            Common causes: image-only scans without OCR, password-protected PDFs, or files
            larger than the supported size.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" disabled aria-disabled>
              <RefreshCw className="size-3.5" /> Re-analyze
            </Button>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
              Coming soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonBlock({
  heightClass,
  widthClass,
}: {
  heightClass: string;
  widthClass: string;
}) {
  return (
    <div
      className={`${heightClass} ${widthClass} animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface-2)]`}
    />
  );
}
