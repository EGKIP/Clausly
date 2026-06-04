"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  FileText,
  Sparkles,
  CalendarClock,
  ShieldAlert,
  CheckCircle2,
  Quote,
} from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { RiskPill } from "@/components/ui/risk-pill";

/* ───────────────────────────────────────────────────────────────────────
   Hero visual — a stylised "AI reading your contract" composition.
   Left:  the source document (a parchment-coloured page with redacted text)
   Right: extracted artefacts that float out of it (clause card, deadline,
          risk callout, reminder approval) connected with delicate paths.
   ─────────────────────────────────────────────────────────────────── */

export function HeroVisual() {
  const reduce = useReducedMotion();
  const float = (delay = 0): React.ComponentProps<typeof motion.div> =>
    reduce
      ? {}
      : {
          animate: { y: [0, -6, 0] },
          transition: {
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay,
          },
        };

  return (
    <div className="relative h-[460px] md:h-[520px] w-full">
      {/* Soft ambient glow under the composition */}
      <div
        aria-hidden
        className="absolute inset-x-10 top-12 h-72 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklch, var(--accent) 35%, transparent), transparent)",
        }}
      />

      {/* Connector paths — drawn behind cards */}
      <svg
        aria-hidden
        className="absolute inset-0 size-full pointer-events-none"
        viewBox="0 0 800 520"
        fill="none"
      >
        <defs>
          <linearGradient id="connector" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="color-mix(in oklch, var(--accent) 70%, transparent)" />
            <stop offset="100%" stopColor="color-mix(in oklch, var(--accent) 10%, transparent)" />
          </linearGradient>
        </defs>
        {[
          "M 280 130 C 360 130, 380 90, 470 90",
          "M 290 230 C 380 230, 400 220, 500 220",
          "M 290 320 C 380 320, 400 360, 490 360",
        ].map((d, i) => (
          <motion.path
            key={d}
            d={d}
            stroke="url(#connector)"
            strokeWidth="1.25"
            strokeDasharray="3 4"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.4, delay: 0.3 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </svg>

      {/* SOURCE DOCUMENT (left) */}
      <motion.div
        {...float(0)}
        className="absolute left-0 md:left-2 top-8 w-[58%] md:w-[46%] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-float)] overflow-hidden"
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.9, ease: [0.165, 0.84, 0.44, 1] }}
        viewport={{ once: true }}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-2)]">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-5 items-center justify-center rounded-[6px] bg-[var(--surface)] border border-[var(--border)]">
              <FileText className="size-3 text-[var(--muted)]" />
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--faint)]">
              Lease_Greenfield_Apt_B12.pdf
            </span>
          </div>
          <span className="font-mono text-[10px] text-[var(--faint)]">14 pp</span>
        </div>
        <div className="p-5 space-y-3">
          <p className="font-serif italic text-[15px] leading-snug text-[var(--foreground)]">
            Residential Lease Agreement
          </p>
          <div className="space-y-1.5">
            {[100, 92, 96, 70, 88, 95, 60, 90, 84].map((w, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full bg-[var(--ink-line,var(--border))]"
                style={{
                  width: `${w}%`,
                  background:
                    i === 3 || i === 6
                      ? "color-mix(in oklch, var(--color-ember) 55%, var(--border))"
                      : undefined,
                }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="font-mono text-[10px] text-[var(--faint)]">p. 4 of 14</span>
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--accent-ink)]">
              <Sparkles className="size-3" />
              Analysing
            </span>
          </div>
        </div>
      </motion.div>

      {/* EXTRACTED: CLAUSE CARD */}
      <motion.div
        {...float(0.4)}
        className="absolute right-2 md:right-8 top-0 w-[60%] md:w-[44%] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] p-3.5"
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.9, delay: 0.15, ease: [0.165, 0.84, 0.44, 1] }}
        viewport={{ once: true }}
      >
        <div className="flex items-center justify-between mb-2">
          <Badge tone="clause">
            <Quote className="size-2.5" />
            Auto-renewal clause
          </Badge>
          <span className="font-mono text-[10px] text-[var(--faint)]">p. 4</span>
        </div>
        <p className="font-serif italic text-[13.5px] leading-snug text-[var(--ink-soft,var(--foreground))]">
          “Lease renews automatically unless tenant gives written notice 60 days prior to term end.”
        </p>
        <p className="mt-2 text-[12px] leading-snug text-[var(--muted)]">
          You&apos;ll need to give notice by{" "}
          <span className="text-[var(--foreground)] font-medium">July 1, 2026</span> to avoid renewal.
        </p>
      </motion.div>

      {/* EXTRACTED: DEADLINE / REMINDER APPROVAL */}
      <motion.div
        {...float(0.8)}
        className="absolute right-0 md:right-4 top-[44%] w-[64%] md:w-[48%] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] p-3.5"
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.9, delay: 0.3, ease: [0.165, 0.84, 0.44, 1] }}
        viewport={{ once: true }}
      >
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-ember-soft)] text-[var(--color-ember-ink)]">
            <CalendarClock className="size-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium">Lease renewal notice deadline</p>
            <p className="text-[11.5px] text-[var(--muted)]">Wed, Jul 1 · 30 days before lease ends</p>
          </div>
          <button className="inline-flex items-center gap-1 rounded-full bg-[var(--foreground)] text-[var(--background)] px-2.5 py-1 text-[11px] font-medium">
            <CheckCircle2 className="size-3" />
            Approve
          </button>
        </div>
      </motion.div>

      {/* EXTRACTED: RISK CALLOUT */}
      <motion.div
        {...float(1.2)}
        className="absolute right-6 md:right-16 top-[78%] w-[54%] md:w-[40%] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] p-3"
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.9, delay: 0.45, ease: [0.165, 0.84, 0.44, 1] }}
        viewport={{ once: true }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <ShieldAlert className="size-3.5 text-[var(--color-coral-ink)]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">
            Risk summary
          </span>
        </div>
        <div className="flex items-center justify-between">
          <RiskPill level="Medium" size="sm" />
          <span className="text-[11px] text-[var(--muted)]">3 items to review</span>
        </div>
      </motion.div>
    </div>
  );
}
