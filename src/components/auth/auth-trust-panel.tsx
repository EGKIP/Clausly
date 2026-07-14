"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BellRing, FileCheck2, LockKeyhole, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";

const trustQuotes = [
  {
    quote: "The calm way to keep contracts, clauses, and reminders in one place.",
    label: "Organized workspace",
  },
  {
    quote: "Important dates stay visible before they become expensive surprises.",
    label: "Deadline clarity",
  },
  {
    quote: "Ask questions against the document itself, with citations you can inspect.",
    label: "Grounded answers",
  },
  {
    quote: "Nothing becomes a reminder until you approve it.",
    label: "User control",
  },
] as const;

const trustSignals = [
  { icon: FileCheck2, label: "Contracts organized" },
  { icon: BellRing, label: "Reminders approved by you" },
  { icon: MessageSquareText, label: "Answers cite the source" },
  { icon: LockKeyhole, label: "Private workspace" },
] as const;

export function AuthTrustPanel({ quote }: { quote: string }) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = React.useState(0);
  const quotes = React.useMemo(
    () => [quote, ...trustQuotes.map((item) => item.quote).filter((item) => item !== quote)],
    [quote]
  );

  React.useEffect(() => {
    if (reduceMotion || quotes.length <= 1) return;
    const interval = window.setInterval(() => {
      setActive((value) => (value + 1) % quotes.length);
    }, 5200);

    return () => window.clearInterval(interval);
  }, [quotes.length, reduceMotion]);

  return (
    <div className="mt-7">
      <div className="min-h-[116px] border-l-2 border-[var(--accent)] pl-5">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--faint)]">
          {trustQuotes[active % trustQuotes.length]?.label ?? "Clausly"}
        </p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.blockquote
            key={quotes[active]}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: [0.165, 0.84, 0.44, 1] }}
            className="mt-3 font-serif text-[22px] leading-[1.35] text-[var(--accent-ink)]"
          >
            &ldquo;{quotes[active]}&rdquo;
          </motion.blockquote>
        </AnimatePresence>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-2.5">
        {trustSignals.map(({ icon: Icon, label }, index) => (
          <motion.div
            key={label}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduceMotion ? 0 : 0.08 * index, duration: 0.35 }}
            className={cn(
              "rounded-[var(--radius-md)] border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_76%,transparent)]",
              "px-3.5 py-3 shadow-[var(--shadow-card)] backdrop-blur"
            )}
          >
            <Icon className="size-4 text-[var(--accent)]" />
            <p className="mt-2 text-[12.5px] leading-snug text-[var(--muted)]">
              {label}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
