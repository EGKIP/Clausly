"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { Clause } from "@/lib/mock-clauses";
import { cn } from "@/lib/utils";

/* The real renderer is heavy (react-pdf + pdfjs ~150kB). Only ship it on
 * detail pages when a signed URL is actually available. */
const PDFViewer = dynamic(() => import("./pdf-viewer").then((m) => m.PDFViewer), {
  ssr: false,
  loading: () => (
    <div className="mx-auto aspect-[8.5/11] w-full max-w-[520px] rounded-[6px] border border-[var(--border)] bg-white/60 backdrop-blur-sm flex items-center justify-center">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
        Loading viewer…
      </p>
    </div>
  ),
});

const ZOOM_STEPS = [0.75, 0.9, 1, 1.15, 1.35, 1.6] as const;

/* The preview pane wraps either the real react-pdf viewer (when a signed URL
 * is provided) or a paper-style facsimile used by the v0.1 demo. The chrome
 * and clause-aware page logic are identical in both modes. */
export function PDFPreview({
  docTitle,
  pages,
  activeClause,
  signedUrl,
}: {
  docTitle: string;
  pages: number;
  activeClause?: Clause;
  signedUrl?: string | null;
}) {
  const [page, setPage] = React.useState<number>(activeClause?.page ?? 1);
  const [zoomIdx, setZoomIdx] = React.useState<number>(2);
  const [totalPages, setTotalPages] = React.useState<number>(pages);
  const [viewerError, setViewerError] = React.useState<string | null>(null);

  // Follow the active clause to its page.
  React.useEffect(() => {
    if (activeClause?.page) setPage(activeClause.page);
  }, [activeClause?.page]);

  const zoom = ZOOM_STEPS[zoomIdx];
  const canRenderReal = Boolean(signedUrl) && !viewerError;
  const handleViewerError = React.useCallback((message: string) => {
    setViewerError(message || "PDF preview could not load.");
  }, []);

  return (
    <div className="flex h-[560px] min-w-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] sm:h-[680px]">
      {/* Chrome */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
            PDF preview
          </span>
          <span className="text-[var(--faint)]">·</span>
          <span className="truncate text-[12px] text-[var(--muted)]">{docTitle}</span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            disabled={zoomIdx === 0}
            onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
            label="Zoom out"
          >
            <ZoomOut className="size-3.5" />
          </IconButton>
          <IconButton
            disabled={zoomIdx === ZOOM_STEPS.length - 1}
            onClick={() => setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            label="Zoom in"
          >
            <ZoomIn className="size-3.5" />
          </IconButton>
          <IconButton label="Fit width" onClick={() => setZoomIdx(2)}>
            <Maximize2 className="size-3.5" />
          </IconButton>
          {canRenderReal && (
            <a
              href={signedUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-10 items-center justify-center rounded-[var(--radius-xs)] text-[var(--faint)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] sm:size-7"
              aria-label="Download"
            >
              <Download className="size-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Document body */}
      <div className="flex-1 overflow-auto bg-[var(--surface-2)] px-3 py-5 sm:px-6 sm:py-8 md:px-10">
        {canRenderReal ? (
          <PdfPreviewErrorBoundary key={signedUrl} onError={handleViewerError}>
            <PDFViewer
              url={signedUrl!}
              page={page}
              zoom={zoom}
              activeClause={activeClause}
              onLoad={(nextTotalPages) => {
                setTotalPages(nextTotalPages);
                setPage((currentPage) => Math.min(currentPage, Math.max(1, nextTotalPages)));
              }}
              onError={handleViewerError}
            />
          </PdfPreviewErrorBoundary>
        ) : (
          <FauxPaper docTitle={docTitle} page={page} pages={totalPages} activeClause={activeClause} />
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-mono text-[10.5px] text-[var(--faint)] sm:gap-3 sm:px-4">
        <div className="flex items-center gap-1">
          <IconButton
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            label="Previous page"
          >
            <ChevronLeft className="size-3.5" />
          </IconButton>
          <span className="tabular-nums">
            Page {page} / {totalPages || pages}
          </span>
          <IconButton
            disabled={page >= (totalPages || pages)}
            onClick={() => setPage((p) => Math.min(totalPages || pages, p + 1))}
            label="Next page"
          >
            <ChevronRight className="size-3.5" />
          </IconButton>
        </div>
        <span className="min-w-0 truncate">
          {viewerError
            ? viewerError
            : canRenderReal
              ? `Native text · ${Math.round(zoom * 100)}%`
              : "Native text · OCR not required"}
        </span>
      </div>
    </div>
  );
}

class PdfPreviewErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (message: string) => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error instanceof Error ? error.message : "PDF preview could not load.");
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto aspect-[8.5/11] w-full max-w-[520px] rounded-[6px] border border-[color-mix(in_oklch,var(--color-coral)_30%,var(--border))] bg-white/60 backdrop-blur-sm flex items-center justify-center">
          <p className="px-6 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
            PDF preview is unavailable.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

function IconButton({
  children,
  disabled,
  onClick,
  label,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-[var(--radius-xs)] text-[var(--faint)] transition-colors sm:size-7",
        "hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]",
        "disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--faint)]"
      )}
    >
      {children}
    </button>
  );
}

function FauxPaper({
  docTitle,
  page,
  pages,
  activeClause,
}: {
  docTitle: string;
  page: number;
  pages: number;
  activeClause?: Clause;
}) {
  const widths = ["100%", "98%", "94%", "96%", "92%", "100%", "95%", "88%", "100%", "97%", "93%", "100%", "99%", "94%", "96%", "70%"];
  return (
    <motion.div
      key={page}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="relative mx-auto aspect-[8.5/11] w-full max-w-[520px] rounded-[6px] bg-white p-6 text-[#1a1d24] shadow-[0_1px_0_oklch(0%_0_0/0.04),0_24px_60px_-24px_oklch(20%_0.03_260/0.18)] sm:p-10"
    >
      <p className="text-center font-serif text-[14px] tracking-[0.18em] uppercase text-[#1a1d24]/60">
        {docTitle}
      </p>
      <div className="mt-1 h-px bg-[#1a1d24]/15" />

      <div className="mt-6 space-y-2.5">
        {widths.map((width, i) => {
          const isClause = activeClause && i >= 5 && i <= 8;
          return (
            <div key={i} className="flex items-center gap-2">
              {isClause && i === 5 && (
                <span
                  className="absolute left-3 size-1.5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--accent)]/30 animate-pulse-soft"
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  "h-2 rounded-full transition-colors",
                  isClause ? "bg-[oklch(54%_0.11_175_/_0.35)]" : "bg-[#1a1d24]/12"
                )}
                style={{ width }}
              />
            </div>
          );
        })}
      </div>

      <p className="absolute bottom-4 right-6 font-mono text-[10px] text-[#1a1d24]/40">
        Page {page} of {pages}
      </p>

      {activeClause && (
        <motion.div
          layout
          className="absolute left-8 right-8 rounded-[3px] border-l-2 border-[var(--accent)] bg-[oklch(54%_0.11_175_/_0.08)] px-3 py-1.5 pointer-events-none"
          style={{ top: "200px" }}
        >
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[oklch(28%_0.07_175)]">
            Highlighted clause
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
