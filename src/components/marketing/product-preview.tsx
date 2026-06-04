"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  ListFilter,
  BellRing,
  Search,
  Plus,
  CalendarClock,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Container, Eyebrow, Headline, Badge } from "@/components/ui/primitives";
import { RiskPill } from "@/components/ui/risk-pill";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

type Tab = "dashboard" | "document" | "portfolio" | "reminders";
const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "document", label: "Document detail", icon: FileText },
  { id: "portfolio", label: "Portfolio", icon: ListFilter },
  { id: "reminders", label: "Reminders", icon: BellRing },
];

export function ProductPreview() {
  const [active, setActive] = React.useState<Tab>("dashboard");
  return (
    <section id="preview" className="relative py-24 md:py-32">
      <Container>
        <div className="max-w-2xl mb-12">
          <Reveal>
            <Eyebrow>The product</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <Headline className="mt-5">
              A workspace built around{" "}
              <span className="italic text-[var(--accent-ink)]">action</span>, not storage.
            </Headline>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 text-[16.5px] leading-relaxed text-[var(--muted)]">
              Click through the surfaces. This is the real interface, rendered live —
              not a screenshot.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <div className="relative rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface-2)] p-3 md:p-4 shadow-[var(--shadow-float)]">
            {/* Tab strip */}
            <div className="flex items-center gap-1.5 p-1 bg-[var(--background)] rounded-[var(--radius-md)] border border-[var(--border)] mb-3 overflow-x-auto scrollbar-none">
              {tabs.map((t) => {
                const isActive = active === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActive(t.id)}
                    className={cn(
                      "relative inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors",
                      isActive
                        ? "text-[var(--foreground)]"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="preview-tab-pill"
                        className="absolute inset-0 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)]"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    <t.icon className="relative size-3.5" />
                    <span className="relative">{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* App chrome frame */}
            <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--background)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)]">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[var(--surface-3)]" />
                  <span className="size-2.5 rounded-full bg-[var(--surface-3)]" />
                  <span className="size-2.5 rounded-full bg-[var(--surface-3)]" />
                </div>
                <div className="rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 font-mono text-[10.5px] text-[var(--faint)] tracking-wider">
                  clausly.app/{active === "document" ? "doc/greenfield-lease" : active}
                </div>
                <div className="size-6" />
              </div>

              <div className="min-h-[420px] md:min-h-[480px] p-4 md:p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                  >
                    {active === "dashboard" && <DashboardSurface />}
                    {active === "document" && <DocumentSurface />}
                    {active === "portfolio" && <PortfolioSurface />}
                    {active === "reminders" && <RemindersSurface />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

/* ── Mock surfaces ─────────────────────────────────────────────────── */
function DashboardSurface() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]">
            Tuesday · Welcome back
          </p>
          <h3 className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
            3 things need your attention.
          </h3>
        </div>
        <div className="space-y-2">
          {[
            { i: ShieldAlert, t: "ember", title: "Auto insurance renewal", sub: "In 11 days · State Farm policy", risk: "Medium" as const },
            { i: CalendarClock, t: "coral", title: "Lease notice deadline", sub: "In 28 days · Greenfield Apartments", risk: "High" as const },
            { i: Sparkles, t: "iris", title: "New summary ready", sub: "Freelance contract · ready to review", risk: "Needs Review" as const },
          ].map(({ i: I, t, title, sub, risk }) => (
            <div
              key={title}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3.5 flex items-center gap-3"
            >
              <span className={cn(
                "inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)]",
                t === "ember" && "bg-[var(--color-ember-soft)] text-[var(--color-ember-ink)]",
                t === "coral" && "bg-[var(--color-coral-soft)] text-[var(--color-coral-ink)]",
                t === "iris" && "bg-[var(--color-iris-soft)] text-[var(--color-iris)]",
              )}>
                <I className="size-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium">{title}</p>
                <p className="text-[12px] text-[var(--muted)]">{sub}</p>
              </div>
              <RiskPill level={risk} size="sm" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)] mb-3">Portfolio</p>
          <div className="grid grid-cols-2 gap-2 text-center">
            {[{ n: 12, l: "Active" }, { n: 3, l: "High risk" }, { n: 7, l: "Reminders" }, { n: 2, l: "Pending review" }].map((s) => (
              <div key={s.l} className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] py-3">
                <p className="font-serif text-[22px] leading-none">{s.n}</p>
                <p className="text-[11px] text-[var(--muted)] mt-1">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[color-mix(in_oklch,var(--accent)_30%,var(--border))] bg-[var(--accent-soft)] p-4">
          <Badge tone="clause"><Sparkles className="size-2.5" />Pro</Badge>
          <p className="mt-2 text-[13px] text-[var(--accent-ink)] leading-relaxed">
            This week: 1 contract auto-renews, 2 reminders fire, 0 risky clauses changed.
          </p>
        </div>
      </div>
    </div>
  );
}

function DocumentSurface() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <RiskPill level="Medium" size="sm" />
          <Badge tone="outline">Lease</Badge>
          <Badge tone="outline">Minnesota</Badge>
          <Badge tone="outline">14 pages</Badge>
        </div>
        <h3 className="font-serif text-[26px] leading-tight tracking-[-0.01em]">
          Greenfield Apartments — Unit B12
        </h3>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--muted)]">
          12-month residential lease at $1,850/mo, beginning Sep 1, 2025. Auto-renews
          unless tenant provides 60 days&apos; written notice. Minnesota law governs.
        </p>
        <div className="mt-5 grid gap-2">
          {[
            { c: "Auto-renewal", r: "Medium" as const, p: 4 },
            { c: "Late payment fee", r: "Medium" as const, p: 6 },
            { c: "Security deposit", r: "Low" as const, p: 2 },
            { c: "Early termination", r: "High" as const, p: 9 },
          ].map((cl) => (
            <div key={cl.c} className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
              <span className="text-[13px]">{cl.c}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10.5px] text-[var(--faint)]">p. {cl.p}</span>
                <RiskPill level={cl.r} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)] mb-2">Dates</p>
          {[
            ["Effective", "Sep 1, 2025"],
            ["Notice by", "Jul 1, 2026"],
            ["Ends", "Aug 31, 2026"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-1.5 text-[12.5px] border-b border-[var(--border)] last:border-0">
              <span className="text-[var(--muted)]">{k}</span>
              <span className="font-mono tabular-nums">{v}</span>
            </div>
          ))}
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)] mb-2">Ask Clausly</p>
          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] p-2.5 text-[12px] text-[var(--muted)]">
            What happens if I move out early?
          </div>
        </div>
      </div>
    </div>
  );
}

function PortfolioSurface() {
  const rows = [
    { t: "Greenfield Apartments Lease", k: "Lease · MN", end: "Aug 31, 2026", risk: "Medium" as const },
    { t: "State Farm Auto Policy", k: "Insurance · MN", end: "Jun 14, 2026", risk: "Low" as const },
    { t: "Acme Freelance Agreement", k: "Service · CA", end: "Dec 31, 2026", risk: "Needs Review" as const },
    { t: "Verizon Wireless Contract", k: "Service · —", end: "Mar 12, 2027", risk: "Low" as const },
    { t: "Storage Lease — Bin 14", k: "Lease · MN", end: "Oct 1, 2026", risk: "Low" as const },
    { t: "Gym Membership Terms", k: "Service · —", end: "May 30, 2026", risk: "High" as const },
  ];
  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--faint)]" />
            <input
              readOnly
              defaultValue="lease"
              className="h-8 w-56 rounded-full border border-[var(--border)] bg-[var(--surface)] pl-8 pr-3 text-[12.5px] placeholder:text-[var(--faint)] focus:outline-none"
            />
          </div>
          <Badge tone="outline">All risk</Badge>
          <Badge tone="outline">All types</Badge>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-full bg-[var(--foreground)] text-[var(--background)] px-3 py-1.5 text-[12px] font-medium">
          <Plus className="size-3.5" /> Upload
        </button>
      </div>
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        {rows.map((r, i) => (
          <div
            key={r.t}
            className={cn(
              "grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3 text-[13px]",
              i !== rows.length - 1 && "border-b border-[var(--border)]"
            )}
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{r.t}</p>
              <p className="text-[11.5px] text-[var(--muted)]">{r.k}</p>
            </div>
            <span className="font-mono text-[11px] text-[var(--muted)] tabular-nums">{r.end}</span>
            <RiskPill level={r.risk} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RemindersSurface() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)] mb-2">
          Suggested · awaiting your approval
        </p>
        <div className="space-y-2">
          {[
            ["Lease notice deadline", "Jul 1, 2026 · Greenfield"],
            ["Insurance renewal", "Jun 14, 2026 · State Farm"],
            ["Gym auto-renew", "May 12, 2026 · Cancel before"],
          ].map(([t, s]) => (
            <div key={t} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3.5 flex items-center gap-3">
              <span className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-ember-soft)] text-[var(--color-ember-ink)]">
                <BellRing className="size-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium">{t}</p>
                <p className="text-[11.5px] text-[var(--muted)]">{s}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button className="rounded-full bg-[var(--foreground)] text-[var(--background)] px-2.5 py-1 text-[11px] font-medium">Approve</button>
                <button className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--muted)]">Ignore</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--accent-ink)] mb-2">
          Active · approved by you
        </p>
        <div className="space-y-2">
          {[
            ["Apt B12 lease ends", "Aug 31, 2026 · in 86 days"],
            ["Quarterly contractor invoice", "Sep 1, 2026 · in 87 days"],
            ["Verizon plan renewal", "Mar 12, 2027 · in 280 days"],
          ].map(([t, s]) => (
            <div key={t} className="rounded-[var(--radius-md)] border border-[color-mix(in_oklch,var(--accent)_30%,var(--border))] bg-[color-mix(in_oklch,var(--accent-soft)_30%,var(--surface))] p-3.5 flex items-center gap-3">
              <span className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)] text-white">
                <CalendarClock className="size-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium">{t}</p>
                <p className="text-[11.5px] text-[var(--accent-ink)]">{s}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
