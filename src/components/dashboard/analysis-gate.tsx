"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DocumentStatus } from "@/lib/db/types";
import { useDocumentStatusPoll } from "@/lib/hooks/use-document";
import { notifyDocumentsChanged } from "@/lib/hooks/use-documents";
import { FAILURE_CATEGORY_COPY, type AnalysisFailureCategory } from "@/lib/ai/failure-categories";

/* Branches the document detail page rendering on the document.status field.
 * - ready   → renders children (the real DocumentView)
 * - pending → same skeleton as analyzing; we treat it as "just queued"
 * - analyzing → skeleton + polling, refresh server data when status flips
 * - failed  → error card with a category-specific message and a retry button */
export function AnalysisGate({
  documentId,
  initialStatus,
  initialErrorMessage,
  initialFailureCategory,
  children,
}: {
  documentId: string;
  initialStatus: DocumentStatus;
  initialErrorMessage: string | null;
  initialFailureCategory: AnalysisFailureCategory | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [localStatus, setLocalStatus] = React.useState<DocumentStatus | null>(null);
  const pollingInitialStatus = localStatus ?? initialStatus;
  const { status, errorMessage, failureCategory } = useDocumentStatusPoll(documentId, pollingInitialStatus, {
    enabled: pollingInitialStatus === "analyzing" || pollingInitialStatus === "pending",
  });

  /* When the analysis completes (or fails), refetch the server component so
   * the detail page hydrates with the freshly-persisted clauses/dates. */
  React.useEffect(() => {
    if (status !== initialStatus && (status === "ready" || status === "failed")) {
      notifyDocumentsChanged();
      router.refresh();
    }
  }, [router, status, initialStatus]);

  if (status === "ready") return <>{children}</>;
  if (status === "failed") {
    return (
      <FailedState
        documentId={documentId}
        message={errorMessage ?? initialErrorMessage}
        category={failureCategory ?? initialFailureCategory}
        onRetryStarted={() => setLocalStatus("analyzing")}
      />
    );
  }
  return <AnalyzingState />;
}

/* Thresholds (ms) after which the "still working" copy escalates. Tuned
 * against the normal case (a few seconds) and the stuck-analysis recovery
 * cron, which requeues anything stuck past ~10 minutes. */
const SLOW_NOTICE_MS = 20_000;
const VERY_SLOW_NOTICE_MS = 90_000;

function AnalyzingState() {
  const [elapsedTier, setElapsedTier] = React.useState<"normal" | "slow" | "verySlow">("normal");

  React.useEffect(() => {
    const slowTimer = setTimeout(() => setElapsedTier("slow"), SLOW_NOTICE_MS);
    const verySlowTimer = setTimeout(() => setElapsedTier("verySlow"), VERY_SLOW_NOTICE_MS);
    return () => {
      clearTimeout(slowTimer);
      clearTimeout(verySlowTimer);
    };
  }, []);

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
      {elapsedTier !== "normal" && (
        <p className="mt-2 max-w-xl text-[13px] text-[var(--muted)]">
          {elapsedTier === "slow"
            ? "This one's taking a little longer than usual — large or scanned documents can need extra time."
            : "Still working. It's safe to leave this page — analysis continues in the background, and this page will show your results automatically next time you open it."}
        </p>
      )}

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

function FailedState({
  documentId,
  message,
  category,
  onRetryStarted,
}: {
  documentId: string;
  message: string | null;
  category: AnalysisFailureCategory | null;
  onRetryStarted: () => void;
}) {
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [retryError, setRetryError] = React.useState<string | null>(null);
  const copy = category ? FAILURE_CATEGORY_COPY[category] : null;

  async function retryAnalysis() {
    setIsRetrying(true);
    setRetryError(null);

    let response: Response;
    try {
      response = await fetch(`/api/documents/${documentId}/reanalyze`, {
        method: "POST",
      });
    } catch {
      setRetryError("Re-analysis failed. Check your connection and try again.");
      setIsRetrying(false);
      return;
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Re-analysis failed." }));
      setRetryError(payload.error ?? "Re-analysis failed.");
      setIsRetrying(false);
      return;
    }

    onRetryStarted();
  }

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
            {copy?.title ?? "We couldn't read this contract."}
          </h2>
          <p className="mt-2 max-w-xl text-[13.5px] text-[var(--foreground)] opacity-80">
            {copy?.message ??
              message ??
              "An unexpected error stopped the analysis. The original file is safe and still in your library."}
          </p>
          {!copy && (
            <p className="mt-3 text-[12px] text-[var(--muted)]">
              Common causes: image-only scans without OCR, password-protected PDFs, or files
              larger than the supported size.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onClick={retryAnalysis} disabled={isRetrying}>
              <RefreshCw className={isRetrying ? "size-3.5 animate-spin" : "size-3.5"} />
              {isRetrying ? "Starting..." : "Re-analyze"}
            </Button>
          </div>
          {retryError && (
            <p className="mt-3 rounded-[var(--radius-sm)] border border-[color-mix(in_oklch,var(--color-coral)_28%,var(--border))] bg-[var(--surface)] px-3 py-2 text-[12.5px] text-[var(--color-coral-ink)]">
              {retryError}
            </p>
          )}
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
