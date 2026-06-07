"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BellRing, FileText, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* Editorial "no documents yet" empty state used across dashboard surfaces.
 * Variants tune the headline + hint copy per surface; the visual treatment
 * stays consistent so the portfolio feels like one room with several doors. */
type Variant = "home" | "documents" | "reminders" | "insights";

const copy: Record<Variant, { eyebrow: string; title: React.ReactNode; description: string }> = {
  home: {
    eyebrow: "Start here",
    title: (
      <>
        Your portfolio is{" "}
        <span className="italic text-[var(--accent-ink)]">a quiet shelf</span> — for now.
      </>
    ),
    description:
      "Upload your first document and Clausly will read it carefully, surface the clauses worth knowing, and queue gentle reminders for the dates that matter.",
  },
  documents: {
    eyebrow: "Documents",
    title: (
      <>
        No documents on the shelf <span className="italic text-[var(--accent-ink)]">yet</span>.
      </>
    ),
    description:
      "Add a lease, an insurance policy, an employment offer — anything you've signed. Clausly handles PDFs up to 25 MB, native or scanned.",
  },
  reminders: {
    eyebrow: "Reminders",
    title: (
      <>
        Nothing on the calendar <span className="italic text-[var(--accent-ink)]">yet</span>.
      </>
    ),
    description:
      "Reminders are generated from the documents you upload — renewal dates, notice windows, payment deadlines. Add your first document to seed the queue.",
  },
  insights: {
    eyebrow: "Insights",
    title: (
      <>
        Insights arrive once your{" "}
        <span className="italic text-[var(--accent-ink)]">first document</span> is in.
      </>
    ),
    description:
      "Spend totals, notice windows, and risk patterns are summarised weekly from your portfolio. We need at least one document to start.",
  },
};

export function PortfolioEmptyState({
  variant = "home",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const c = copy[variant];
  const router = useRouter();
  const [seedState, setSeedState] = React.useState<"idle" | "loading" | "error">("idle");
  const [seedError, setSeedError] = React.useState<string | null>(null);

  async function seedDemo() {
    setSeedState("loading");
    setSeedError(null);
    const response = await fetch("/api/seed-demo", { method: "POST" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Could not seed demo data." }));
      setSeedError(payload.error ?? "Could not seed demo data.");
      setSeedState("error");
      return;
    }
    router.refresh();
  }

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)]",
        "bg-gradient-to-b from-[var(--surface)] via-[var(--surface)] to-[var(--surface-2)]",
        "px-6 py-12 md:px-12 md:py-16",
        className
      )}
    >
      <div
        aria-hidden
        className="absolute -top-24 -right-24 size-72 rounded-full opacity-30 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--accent) 40%, transparent), transparent 70%)",
        }}
      />

      <div className="relative grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-center">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--faint)]">
            {c.eyebrow}
          </p>
          <h2 className="mt-3 font-serif text-[clamp(1.8rem,3vw,2.4rem)] leading-[1.08] tracking-[-0.015em] text-balance">
            {c.title}
          </h2>
          <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-[var(--muted)]">
            {c.description}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="md" href="/dashboard/documents?upload=1">
              <Upload className="size-3.5" /> Upload your first document
            </Button>
            <Button variant="ghost" size="md" href="/dashboard/welcome">
              How it works <ArrowRight className="size-3.5" />
            </Button>
          </div>

          <div className="mt-3">
            <Button
              variant="secondary"
              size="md"
              onClick={seedDemo}
              disabled={seedState === "loading"}
            >
              <Sparkles className="size-3.5" />
              {seedState === "loading" ? "Reading three sample contracts..." : "Try with sample data"}
            </Button>
            {seedError && (
              <p className="mt-2 text-[12px] text-[var(--color-coral-ink)]">
                {seedError}
              </p>
            )}
          </div>

          <p className="mt-6 inline-flex items-center gap-1.5 text-[11.5px] text-[var(--faint)]">
            <ShieldCheck className="size-3" />
            Encrypted at rest · never used to train AI models · you stay in control
          </p>
        </div>

        <Steps />
      </div>
    </section>
  );
}

function Steps() {
  const steps = [
    { icon: Upload, label: "Upload", hint: "Drop a PDF — we read it page by page." },
    { icon: Sparkles, label: "Review", hint: "Clausly highlights the clauses worth knowing." },
    { icon: BellRing, label: "Get reminded", hint: "Approve reminders before they fire." },
  ];
  return (
    <ol className="relative grid gap-3">
      {steps.map((s, i) => (
        <li
          key={s.label}
          className="relative flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5"
        >
          <span className="inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--accent-ink)] shrink-0">
            <s.icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium leading-tight">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)] mr-2">
                0{i + 1}
              </span>
              {s.label}
            </p>
            <p className="mt-1 text-[12px] text-[var(--muted)] leading-relaxed">{s.hint}</p>
          </div>
        </li>
      ))}
      <li className="mt-2 flex items-center gap-2 text-[11.5px] text-[var(--faint)]">
        <FileText className="size-3" />
        <Link href="/dashboard/welcome" className="hover:text-[var(--muted)]">
          See the full tour
        </Link>
      </li>
    </ol>
  );
}
