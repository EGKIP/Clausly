"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  FileText,
  BellRing,
  LayoutDashboard,
  Sparkles,
  Upload,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { documents } from "@/lib/mock-data";
import { RiskPill } from "@/components/ui/risk-pill";
import { cn } from "@/lib/utils";

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = React.useState("");
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) requestAnimationFrame(() => ref.current?.focus());
    else setQ("");
  }, [open]);

  const filteredDocs = documents
    .filter((d) =>
      q ? (d.title + " " + d.party + " " + d.type).toLowerCase().includes(q.toLowerCase()) : true
    )
    .slice(0, 5);

  const actions = [
    { id: "dash", label: "Go to overview", icon: LayoutDashboard, href: "/dashboard" },
    { id: "docs", label: "Go to documents", icon: FileText, href: "/dashboard/documents" },
    { id: "rem", label: "Go to reminders", icon: BellRing, href: "/dashboard/reminders" },
    { id: "ins", label: "Go to insights", icon: Sparkles, href: "/dashboard/insights" },
    { id: "up", label: "Upload a new document", icon: Upload, href: "/dashboard/documents" },
  ].filter((a) => (q ? a.label.toLowerCase().includes(q.toLowerCase()) : true));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh] bg-[oklch(15%_0.02_260/0.4)] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[640px] rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-float)] overflow-hidden"
          >
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--border)]">
              <Search className="size-4 text-[var(--faint)]" />
              <input
                ref={ref}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search documents, clauses, reminders…"
                className="flex-1 bg-transparent focus:outline-none text-[14.5px] placeholder:text-[var(--faint)]"
              />
              <kbd className="font-mono text-[10.5px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--muted)]">
                Esc
              </kbd>
            </div>

            <div className="max-h-[420px] overflow-y-auto py-2">
              {filteredDocs.length > 0 && (
                <Section label="Documents">
                  {filteredDocs.map((d) => (
                    <Link
                      key={d.id}
                      href={`/dashboard/documents/${d.id}`}
                      onClick={onClose}
                      className="group flex items-center gap-3 px-3 mx-2 py-2 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)]"
                    >
                      <span className="inline-flex size-7 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--surface-2)] border border-[var(--border)]">
                        <FileText className="size-3.5 text-[var(--muted)]" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-[13.5px]">{d.title}</p>
                        <p className="truncate text-[11.5px] text-[var(--muted)]">
                          {d.type} · {d.party}
                        </p>
                      </div>
                      <RiskPill level={d.risk} size="sm" />
                    </Link>
                  ))}
                </Section>
              )}
              {actions.length > 0 && (
                <Section label="Actions">
                  {actions.map((a) => (
                    <Link
                      key={a.id}
                      href={a.href}
                      onClick={onClose}
                      className="flex items-center gap-3 px-3 mx-2 py-2 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)]"
                    >
                      <span className="inline-flex size-7 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--surface-2)] border border-[var(--border)]">
                        <a.icon className="size-3.5 text-[var(--muted)]" />
                      </span>
                      <span className="text-[13.5px]">{a.label}</span>
                    </Link>
                  ))}
                </Section>
              )}
              {filteredDocs.length === 0 && actions.length === 0 && (
                <p className="px-5 py-10 text-center text-[13px] text-[var(--muted)]">
                  No results. Try a different search.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border)] bg-[var(--surface-2)] text-[11px] text-[var(--faint)]">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <Kbd>
                    <ArrowUp className="size-2.5" />
                  </Kbd>
                  <Kbd>
                    <ArrowDown className="size-2.5" />
                  </Kbd>
                  navigate
                </span>
                <span className="inline-flex items-center gap-1">
                  <Kbd>
                    <CornerDownLeft className="size-2.5" />
                  </Kbd>
                  open
                </span>
              </div>
              <span>Clausly · v0.1</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <p className="px-5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
        {label}
      </p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex size-5 items-center justify-center rounded border border-[var(--border)] bg-[var(--background)] text-[var(--muted)]"
      )}
    >
      {children}
    </kbd>
  );
}
