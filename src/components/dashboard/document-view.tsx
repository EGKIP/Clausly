"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  ListTree,
  CalendarClock,
  BellRing,
  MessageSquare,
  Quote,
  ChevronRight,
  Send,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import type { ContractDoc } from "@/lib/mock-data";
import type { Clause } from "@/lib/mock-clauses";
import type { Reminder } from "@/lib/mock-reminders";
import { RiskPill } from "@/components/ui/risk-pill";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { PDFPreview } from "./pdf-preview";
import { cn } from "@/lib/utils";

type Tab = "summary" | "clauses" | "dates" | "reminders" | "ask";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "summary", label: "Summary", icon: FileText },
  { id: "clauses", label: "Clauses", icon: ListTree },
  { id: "dates", label: "Dates", icon: CalendarClock },
  { id: "reminders", label: "Reminders", icon: BellRing },
  { id: "ask", label: "Ask Clausly", icon: MessageSquare },
];

export function DocumentView({
  doc,
  clauses,
  reminders,
}: {
  doc: ContractDoc;
  clauses: Clause[];
  reminders: Reminder[];
}) {
  const [tab, setTab] = React.useState<Tab>("summary");
  const [activeClauseId, setActiveClauseId] = React.useState<string | undefined>(clauses[0]?.id);
  const activeClause = clauses.find((c) => c.id === activeClauseId);

  return (
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,520px)] gap-6">
      {/* Left column: tabs */}
      <div>
        <div className="flex items-center gap-1 p-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] overflow-x-auto scrollbar-none">
          {tabs.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors",
                  active ? "text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="doc-tab"
                    className="absolute inset-0 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <t.icon className="relative size-3.5" />
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {tab === "summary" && <SummaryPanel doc={doc} clauses={clauses} />}
              {tab === "clauses" && (
                <ClausesPanel clauses={clauses} active={activeClauseId} onSelect={setActiveClauseId} />
              )}
              {tab === "dates" && <DatesPanel doc={doc} />}
              {tab === "reminders" && <RemindersPanel reminders={reminders} />}
              {tab === "ask" && <AskPanel docTitle={doc.title} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Right column: PDF */}
      <div className="lg:sticky lg:top-[88px] self-start">
        <PDFPreview docTitle={doc.title} pages={doc.pages} activeClause={activeClause} />
      </div>
    </div>
  );
}

/* ── Summary ────────────────────────────────────────────────────────── */
function SummaryPanel({ doc, clauses }: { doc: ContractDoc; clauses: Clause[] }) {
  const counts = {
    high: clauses.filter((c) => c.risk === "High").length,
    medium: clauses.filter((c) => c.risk === "Medium").length,
    low: clauses.filter((c) => c.risk === "Low").length,
  };
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 md:p-7">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="size-3.5 text-[var(--accent)]" />
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--accent-ink)]">
          AI summary
        </p>
      </div>
      <p className="font-serif text-[20px] leading-[1.4] tracking-[-0.005em] text-balance">
        {doc.summary}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-2.5">
        {(["high", "medium", "low"] as const).map((k) => (
          <div
            key={k}
            className={cn(
              "rounded-[var(--radius-md)] p-3.5 border",
              k === "high" && "border-[color-mix(in_oklch,var(--color-coral)_25%,var(--border))] bg-[var(--color-coral-soft)]",
              k === "medium" && "border-[color-mix(in_oklch,var(--color-ember)_25%,var(--border))] bg-[var(--color-ember-soft)]",
              k === "low" && "border-[color-mix(in_oklch,var(--color-clause)_22%,var(--border))] bg-[var(--color-clause-soft)]"
            )}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-70">{k} risk</p>
            <p className="font-serif text-[28px] leading-none mt-1.5 tracking-[-0.01em]">
              {counts[k]}
            </p>
            <p className="text-[11px] mt-1 opacity-75">clause{counts[k] === 1 ? "" : "s"}</p>
          </div>
        ))}
      </div>

      <div className="mt-7">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)] mb-3">
          Tags
        </p>
        <div className="flex flex-wrap gap-1.5">
          {doc.tags.map((t) => (
            <Badge key={t} tone="neutral">{t}</Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Clauses ────────────────────────────────────────────────────────── */
function ClausesPanel({
  clauses,
  active,
  onSelect,
}: {
  clauses: Clause[];
  active?: string;
  onSelect: (id: string) => void;
}) {
  const current = clauses.find((c) => c.id === active) ?? clauses[0];
  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
      <ul className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] max-h-[560px] overflow-y-auto">
        {clauses.map((c) => {
          const isActive = c.id === current.id;
          return (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c.id)}
                className={cn(
                  "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[var(--surface-2)] transition-colors",
                  isActive && "bg-[var(--surface-2)]"
                )}
              >
                <span
                  className={cn(
                    "mt-1 size-1.5 rounded-full shrink-0",
                    c.risk === "High" ? "bg-[var(--color-coral)]" :
                    c.risk === "Medium" ? "bg-[var(--color-ember)]" :
                    c.risk === "Needs Review" ? "bg-[var(--color-iris)]" :
                    "bg-[var(--color-clause)]"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium leading-tight truncate">{c.title}</p>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5">
                    {c.category} · p. {c.page}
                  </p>
                </div>
                {isActive && <ChevronRight className="size-3.5 text-[var(--faint)] mt-1" />}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <Badge tone="outline">{current.category}</Badge>
          <div className="flex items-center gap-2">
            <RiskPill level={current.risk} size="sm" />
            <span className="font-mono text-[10.5px] text-[var(--faint)]">p. {current.page}</span>
          </div>
        </div>
        <h3 className="font-serif text-[22px] leading-tight tracking-[-0.01em]">{current.title}</h3>

        <div className="mt-5 rounded-[var(--radius-md)] border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3">
          <p className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-ink)]">
            <Quote className="size-2.5" /> Source quote
          </p>
          <p className="mt-2 font-serif text-[14.5px] leading-[1.55] text-[var(--accent-ink)] italic">
            &ldquo;{current.quote}&rdquo;
          </p>
        </div>

        <div className="mt-5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)] mb-1.5">
            In plain English
          </p>
          <p className="text-[14.5px] leading-relaxed">{current.plainEnglish}</p>
        </div>
        <div className="mt-5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)] mb-1.5">
            Why it matters
          </p>
          <p className="text-[14px] leading-relaxed text-[var(--muted)]">{current.whyItMatters}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Dates ──────────────────────────────────────────────────────────── */
function DatesPanel({ doc }: { doc: ContractDoc }) {
  const items = [
    { label: "Effective", value: doc.effective, days: -90 },
    doc.noticeBy && { label: "Notice deadline", value: doc.noticeBy, days: 27 },
    doc.ends !== "—" && { label: "Ends", value: doc.ends, days: 86 },
  ].filter(Boolean) as { label: string; value: string; days: number }[];
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="space-y-3">
        {items.map((d) => (
          <div key={d.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 border-b border-[var(--border)] last:border-0">
            <div>
              <p className="text-[13px] font-medium">{d.label}</p>
              <p className="text-[11.5px] text-[var(--muted)]">{d.value}</p>
            </div>
            <span className="font-serif text-[20px] tabular-nums tracking-[-0.01em]">
              {d.days < 0 ? `${Math.abs(d.days)}d ago` : `${d.days}d`}
            </span>
            <Button variant="ghost" size="sm">Add reminder</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Reminders ──────────────────────────────────────────────────────── */
function RemindersPanel({ reminders }: { reminders: Reminder[] }) {
  if (reminders.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] p-10 text-center">
        <p className="font-serif text-[18px]">No reminders yet for this document.</p>
        <Button variant="primary" size="sm" className="mt-4">Suggest reminders</Button>
      </div>
    );
  }
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] overflow-hidden">
      {reminders.map((r) => (
        <div key={r.id} className="flex items-center gap-4 px-5 py-4">
          <span className="inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-ember-soft)] text-[var(--color-ember-ink)]">
            <BellRing className="size-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-medium">{r.title}</p>
            <p className="text-[12px] text-[var(--muted)] mt-0.5">{r.description}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono text-[12px] text-[var(--foreground)] tabular-nums">{r.fireOn}</p>
            <p className="font-mono text-[10.5px] text-[var(--faint)] uppercase tracking-[0.12em] mt-1">
              {r.status}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Ask Clausly ────────────────────────────────────────────────────── */
function AskPanel({ docTitle }: { docTitle: string }) {
  const suggestions = [
    "What happens if I move out early?",
    "When do I have to notify the landlord?",
    "Are there any auto-renewal traps?",
    "What's the worst-case financial outcome?",
  ];
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
        Suggested questions
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            className="text-left text-[13px] rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface)]"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
          Example answer
        </p>
        <p className="mt-2 text-[14px] leading-relaxed">
          Based on <span className="font-medium">{docTitle}</span>, breaking the lease
          early costs two months&apos; rent plus your security deposit — about $5,550.
          The early termination clause is on page 9.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-[var(--accent-ink)]">
          <CheckCircle2 className="size-3" /> Cited from clause &ldquo;Early termination&rdquo; (p. 9)
        </p>
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] p-2">
        <input
          placeholder="Ask anything about this document…"
          className="flex-1 bg-transparent px-2 py-2 text-[14px] focus:outline-none placeholder:text-[var(--faint)]"
        />
        <Button variant="primary" size="sm" aria-label="Send">
          <Send className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
