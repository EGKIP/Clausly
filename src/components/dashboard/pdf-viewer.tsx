"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { Clause } from "@/lib/mock-clauses";
import { cn } from "@/lib/utils";

/* Worker is loaded from the CDN matching the pdfjs-dist version bundled with
 * react-pdf. CSP allowlists must include unpkg.com for production. */
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type ViewerProps = {
  url: string;
  page: number;
  zoom: number;
  activeClause?: Clause;
  onLoad?: (pages: number) => void;
  onError?: (message: string) => void;
};

const documentOptions = {
  // pdfjs ships cmaps + fonts as separate assets; pin them to the same CDN.
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
};

export function PDFViewer({ url, page, zoom, activeClause, onLoad, onError }: ViewerProps) {
  const [width, setWidth] = React.useState<number>(0);
  const [totalPages, setTotalPages] = React.useState<number>(0);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry.contentRect.width);
      setWidth((prev) => (prev === next ? prev : next));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const file = React.useMemo(() => ({ url }), [url]);
  const safePage = totalPages > 0 ? Math.min(Math.max(1, page), totalPages) : Math.max(1, page);
  const showOverlay = activeClause && activeClause.page === safePage;
  const handleError = React.useCallback(
    (error: Error) => {
      onError?.(error.message);
    },
    [onError]
  );

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-[640px] overflow-x-auto">
      <Document
        file={file}
        options={documentOptions}
        onLoadSuccess={(doc) => {
          setTotalPages(doc.numPages);
          onLoad?.(doc.numPages);
        }}
        onSourceError={handleError}
        onLoadError={handleError}
        loading={<ViewerSkeleton message="Loading document…" />}
        error={<ViewerSkeleton message="Couldn't load this PDF." tone="warn" />}
      >
        <motion.div
          key={`${page}-${zoom}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="relative inline-block rounded-[6px] overflow-hidden shadow-[0_1px_0_oklch(0%_0_0/0.04),0_24px_60px_-24px_oklch(20%_0.03_260/0.18)] bg-white"
        >
          <Page
            pageNumber={safePage}
            width={width > 0 ? width * zoom : undefined}
            renderTextLayer
            renderAnnotationLayer={false}
            onLoadError={handleError}
            onRenderError={handleError}
            error={<ViewerSkeleton message="Couldn't render this page." tone="warn" />}
            loading={<ViewerSkeleton message="Rendering page…" />}
          />
          {showOverlay && <ClauseOverlay bbox={activeClause.bbox ?? null} />}
        </motion.div>
      </Document>
    </div>
  );
}

function ClauseOverlay({ bbox }: { bbox: [number, number, number, number] | null }) {
  if (!bbox) {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-6 rounded-[3px] border-l-2 border-[var(--accent)] bg-[oklch(54%_0.11_175_/_0.08)] px-3 py-1.5"
      >
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[oklch(28%_0.07_175)]">
          Clause is on this page
        </p>
      </div>
    );
  }
  const [x, y, w, h] = bbox;
  return (
    <motion.div
      layoutId="pdf-clause-overlay"
      aria-hidden
      className="pointer-events-none absolute rounded-[3px] border border-[var(--accent)] bg-[oklch(54%_0.11_175_/_0.18)] mix-blend-multiply"
      style={{
        left: `${clamp(x) * 100}%`,
        top: `${clamp(y) * 100}%`,
        width: `${clamp(w) * 100}%`,
        height: `${clamp(h) * 100}%`,
      }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
    />
  );
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function ViewerSkeleton({ message, tone = "neutral" }: { message: string; tone?: "neutral" | "warn" }) {
  return (
    <div
      className={cn(
        "mx-auto aspect-[8.5/11] w-full max-w-[520px] rounded-[6px] border bg-white/60 backdrop-blur-sm flex items-center justify-center",
        tone === "warn"
          ? "border-[color-mix(in_oklch,var(--color-coral)_30%,var(--border))]"
          : "border-[var(--border)]"
      )}
    >
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
        {message}
      </p>
    </div>
  );
}
