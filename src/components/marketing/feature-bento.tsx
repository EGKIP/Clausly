"use client";

import * as React from "react";
import {
  Sparkles,
  FileSearch,
  ShieldAlert,
  CalendarClock,
  MessageSquareText,
  BellRing,
  FolderOpen,
  TrendingUp,
} from "lucide-react";
import { Container, Eyebrow, Headline, IconBadge, Badge } from "@/components/ui/primitives";
import { RiskPill } from "@/components/ui/risk-pill";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

/* ── Card frame ───────────────────────────────────────────────────────── */
function FeatureCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]",
        "transition-all duration-500 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-float)]",
        className
      )}
    >
      {children}
    </div>
  );
}

function CardCopy({
  icon: Icon,
  eyebrow,
  title,
  description,
  tone = "clause",
}: {
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  description: string;
  tone?: "clause" | "ember" | "coral" | "iris" | "neutral";
}) {
  return (
    <div className="p-6 md:p-7 relative z-10">
      <div className="flex items-center gap-2.5">
        <IconBadge tone={tone} size="md">
          <Icon />
        </IconBadge>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
          {eyebrow}
        </span>
      </div>
      <h3 className="mt-5 font-serif text-[24px] leading-[1.1] tracking-[-0.015em] text-balance">
        {title}
      </h3>
      <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--muted)] text-pretty max-w-md">
        {description}
      </p>
    </div>
  );
}

/* ── Visuals ─────────────────────────────────────────────────────────── */

function SummaryVisual() {
  return (
    <div className="px-6 pb-6 md:px-7 md:pb-7">
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <div className="flex items-center justify-between mb-3">
          <Badge tone="clause">
            <Sparkles className="size-2.5" />
            Plain English
          </Badge>
          <span className="font-mono text-[10px] text-[var(--faint)]">14 pp · 2,940 words</span>
        </div>
        <p className="font-serif text-[15px] italic leading-snug text-[var(--foreground)]">
          “This is a 12-month residential lease for unit B12. Rent is $1,850, due
          on the 1st. It auto-renews unless you give 60 days&apos; notice.”
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {["12-month term", "$1,850/mo", "Auto-renew", "60-day notice", "MN jurisdiction"].map(
            (t) => (
              <span
                key={t}
                className="rounded-md bg-[var(--surface)] border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted)]"
              >
                {t}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function ClauseVisual() {
  const clauses = [
    { cat: "Payment", title: "Late fee", risk: "Medium" as const },
    { cat: "Renewal", title: "Auto-renewal", risk: "Medium" as const },
    { cat: "Termination", title: "Early exit", risk: "High" as const },
    { cat: "Deposit", title: "Security deposit", risk: "Low" as const },
    { cat: "Liability", title: "Indemnification", risk: "Needs Review" as const },
    { cat: "Maintenance", title: "Repair duties", risk: "Low" as const },
  ];
  return (
    <div className="px-6 pb-6 md:px-7 md:pb-7 flex-1 flex flex-col">
      <div className="mt-2 grid gap-2">
        {clauses.map((c, i) => (
          <div
            key={c.title}
            className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5"
            style={{ opacity: 1 - i * 0.05 }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)] w-16 shrink-0">
                {c.cat}
              </span>
              <span className="text-[13px] text-[var(--foreground)] truncate">{c.title}</span>
            </div>
            <RiskPill level={c.risk} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskVisual() {
  const levels = [
    { l: "Low" as const, w: 18 },
    { l: "Medium" as const, w: 42 },
    { l: "High" as const, w: 14 },
    { l: "Needs Review" as const, w: 26 },
  ];
  const colors = ["var(--color-clause)", "var(--color-ember)", "var(--color-coral)", "var(--color-iris)"];
  return (
    <div className="px-6 pb-6 md:px-7 md:pb-7">
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--surface)]">
          {levels.map((lv, i) => (
            <div
              key={lv.l}
              style={{ width: `${lv.w}%`, background: colors[i] }}
              className="h-full"
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {levels.map((lv) => (
            <RiskPill key={lv.l} level={lv.l} size="sm" />
          ))}
        </div>
      </div>
    </div>
  );
}

function DeadlineVisual() {
  const events = [
    { d: "Jun 14", t: "Insurance renewal", tone: "ember" as const },
    { d: "Jul 01", t: "Lease notice deadline", tone: "coral" as const },
    { d: "Aug 31", t: "Lease end", tone: "clause" as const },
  ];
  return (
    <div className="px-6 pb-6 md:px-7 md:pb-7">
      <div className="relative">
        <div className="absolute left-[58px] top-2 bottom-2 w-px bg-[var(--border)]" />
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.t} className="relative flex items-center gap-4">
              <span className="font-mono text-[11px] text-[var(--muted)] w-12 text-right tabular-nums">
                {e.d}
              </span>
              <span
                className="relative z-10 size-2.5 rounded-full ring-4 ring-[var(--surface)]"
                style={{ background: `var(--color-${e.tone})` }}
              />
              <span className="text-[13.5px] text-[var(--foreground)]">{e.t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ReminderVisual() {
  return (
    <div className="px-6 pb-6 md:px-7 md:pb-7 space-y-2">
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3.5 flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-ember-soft)] text-[var(--color-ember-ink)]">
          <BellRing className="size-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium">Renewal notice (Greenfield Lease)</p>
          <p className="text-[11.5px] text-[var(--muted)]">Suggested · 30 days before · Jul 1</p>
        </div>
        <button className="rounded-full bg-[var(--foreground)] text-[var(--background)] px-2.5 py-1 text-[11px] font-medium">
          Approve
        </button>
      </div>
      <div className="rounded-[var(--radius-md)] border border-[color-mix(in_oklch,var(--accent)_30%,var(--border))] bg-[color-mix(in_oklch,var(--accent-soft)_40%,var(--surface))] p-3.5 flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)] text-white">
          <CalendarClock className="size-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium">Auto insurance renewal</p>
          <p className="text-[11.5px] text-[var(--accent-ink)]">Approved · Active reminder</p>
        </div>
        <span className="font-mono text-[10.5px] text-[var(--accent-ink)]">in 11d</span>
      </div>
    </div>
  );
}

function QAVisual() {
  return (
    <div className="px-6 pb-6 md:px-7 md:pb-7">
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-3">
        <p className="text-[13px] text-[var(--muted)]">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--faint)] block mb-1">
            You
          </span>
          Can I sublet for the summer?
        </p>
        <p className="text-[13.5px] text-[var(--foreground)] leading-relaxed">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--accent-ink)] block mb-1">
            Clausly
          </span>
          The lease appears to require written landlord consent before subletting
          (clause 14, p. 6).{" "}
          <span className="text-[var(--muted)]">
            This isn&apos;t legal advice — consider asking your landlord directly.
          </span>
        </p>
      </div>
    </div>
  );
}

/* ── Composition ─────────────────────────────────────────────────────── */
export function FeatureBento() {
  return (
    <section id="features" className="relative py-24 md:py-32">
      <Container>
        <div className="max-w-2xl mb-14 md:mb-20">
          <Reveal>
            <Eyebrow>What Clausly does</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <Headline className="mt-5">
              Every contract,{" "}
              <span className="italic text-[var(--accent-ink)]">
                quietly organised.
              </span>
            </Headline>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 text-[16.5px] leading-relaxed text-[var(--muted)]">
              Six things Clausly does so you don&apos;t have to. Each one feels small.
              Together they replace the spreadsheet you never made.
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5">
          {/* Summary — wide */}
          <FeatureCard className="md:col-span-7 flex flex-col">
            <CardCopy
              icon={Sparkles}
              eyebrow="01 · AI Summary"
              title="Plain-English summary, ready in seconds."
              description="Upload the PDF. Clausly returns a tight, readable summary plus the key terms so you know what you actually signed."
              tone="clause"
            />
            <SummaryVisual />
          </FeatureCard>

          {/* Clauses — tall */}
          <FeatureCard className="md:col-span-5 md:row-span-2 flex flex-col">
            <CardCopy
              icon={FileSearch}
              eyebrow="02 · Clause library"
              title="Every important clause, surfaced and categorised."
              description="Late fees, auto-renewal, termination, indemnity — pulled from the document with page references, in language you can read."
              tone="iris"
            />
            <ClauseVisual />
          </FeatureCard>

          {/* Risk */}
          <FeatureCard className="md:col-span-4 flex flex-col">
            <CardCopy
              icon={ShieldAlert}
              eyebrow="03 · Risk awareness"
              title="Risk you can actually act on."
              description="Calibrated labels with explanations. Never alarmist, never vague."
              tone="coral"
            />
            <RiskVisual />
          </FeatureCard>

          {/* Deadlines */}
          <FeatureCard className="md:col-span-3 flex flex-col">
            <CardCopy
              icon={CalendarClock}
              eyebrow="04 · Deadlines"
              title="A timeline of what's coming."
              description="Notice windows, renewals, expirations — found, dated, surfaced."
              tone="ember"
            />
            <DeadlineVisual />
          </FeatureCard>

          {/* Reminders */}
          <FeatureCard className="md:col-span-6 flex flex-col">
            <CardCopy
              icon={BellRing}
              eyebrow="05 · Reminders you approve"
              title="Suggested by AI. Activated by you."
              description="Nothing reminds you of anything until you approve it. Edit timing, ignore noise, keep what matters."
              tone="ember"
            />
            <ReminderVisual />
          </FeatureCard>

          {/* Q&A */}
          <FeatureCard className="md:col-span-6 flex flex-col">
            <CardCopy
              icon={MessageSquareText}
              eyebrow="06 · Ask Clausly"
              title="Ask the document a question."
              description="Grounded in the file you uploaded, with page references. Says so clearly when it isn't sure."
              tone="clause"
            />
            <QAVisual />
          </FeatureCard>
        </div>

        {/* Pro insight teaser strip */}
        <div className="mt-14 grid md:grid-cols-2 gap-5">
          <ProTeaserCard
            icon={TrendingUp}
            title="Weekly insights — Pro"
            body="A short Monday brief: what's expiring, what's risky, what needs review."
          />
          <ProTeaserCard
            icon={FolderOpen}
            title="A portfolio that scales"
            body="Filter by jurisdiction, risk, end date, type. Free for 5 documents, unlimited on Pro."
          />
        </div>
      </Container>
    </section>
  );
}

function ProTeaserCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-2)] p-6 md:p-7 flex gap-5 items-start">
      <IconBadge tone="iris" size="lg">
        <Icon />
      </IconBadge>
      <div>
        <h4 className="font-serif text-[22px] leading-tight tracking-[-0.01em]">{title}</h4>
        <p className="mt-1.5 text-[14px] text-[var(--muted)] leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
