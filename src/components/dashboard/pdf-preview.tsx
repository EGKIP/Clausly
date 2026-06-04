"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Download, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { Clause } from "@/lib/mock-clauses";
import { cn } from "@/lib/utils";

/* A faux-PDF preview pane — illustrative facsimile of the source document,
 * with the active clause highlighted on its page. No actual PDF parsing. */
export function PDFPreview({
  docTitle,
  pages,
  activeClause,
}: {
  docTitle: string;
  pages: number;
  activeClause?: Clause;
}) {
  const page = activeClause?.page ?? 1;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden flex flex-col h-[680px]">
      {/* Chrome */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
            PDF preview
          </span>
          <span className="text-[var(--faint)]">·</span>
          <span className="truncate text-[12px] text-[var(--muted)]">{docTitle}</span>
        </div>
        <div className="flex items-center gap-1">
          {[ZoomOut, ZoomIn, Maximize2, Download].map((I, i) => (
            <button
              key={i}
              className="inline-flex size-7 items-center justify-center rounded-[var(--radius-xs)] text-[var(--faint)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]"
              aria-label="action"
            >
              <I className="size-3.5" />
            </button>
          ))}
        </div>
      </div>

      {/* Document body */}
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-8 bg-[var(--surface-2)]">
        <motion.div
          key={page}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="relative mx-auto max-w-[520px] rounded-[6px] bg-white shadow-[0_1px_0_oklch(0%_0_0/0.04),0_24px_60px_-24px_oklch(20%_0.03_260/0.18)] aspect-[8.5/11] p-10 text-[#1a1d24]"
        >
          {/* Doc title */}
          <p className="text-center font-serif text-[14px] tracking-[0.18em] uppercase text-[#1a1d24]/60">
            {docTitle}
          </p>
          <div className="mt-1 h-px bg-[#1a1d24]/15" />

          {/* Body lines */}
          <div className="mt-6 space-y-2.5">
            {Array.from({ length: 16 }).map((_, i) => {
              const isClause =
                activeClause && i >= 5 && i <= 8;
              const widths = ["100%", "98%", "94%", "96%", "92%", "100%", "95%", "88%", "100%", "97%", "93%", "100%", "99%", "94%", "96%", "70%"];
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
                      isClause
                        ? "bg-[oklch(54%_0.11_175_/_0.35)]"
                        : "bg-[#1a1d24]/12"
                    )}
                    style={{ width: widths[i] }}
                  />
                </div>
              );
            })}
          </div>

          {/* Page number */}
          <p className="absolute bottom-4 right-6 font-mono text-[10px] text-[#1a1d24]/40">
            Page {page} of {pages}
          </p>

          {/* Highlight overlay marker — when clause active */}
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
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border)] bg-[var(--surface)] font-mono text-[10.5px] text-[var(--faint)]">
        <span>Page {page} / {pages}</span>
        <span>Native text · OCR not required</span>
      </div>
    </div>
  );
}
