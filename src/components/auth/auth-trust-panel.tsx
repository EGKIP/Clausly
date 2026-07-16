"use client";

import * as React from "react";
import { BellRing, FileCheck2, LockKeyhole, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";

type TrustQuote = { quote: string; label: string };

const trustQuotes: readonly TrustQuote[] = [
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
];

const trustSignals = [
  { icon: FileCheck2, label: "Contracts organized" },
  { icon: BellRing, label: "Reminders approved by you" },
  { icon: MessageSquareText, label: "Answers cite the source" },
  { icon: LockKeyhole, label: "Private workspace" },
] as const;

const ROTATE_INTERVAL_MS = 6000;

export function AuthTrustPanel({ quote }: { quote: string }) {
  /* Quote and label rotate together as one item, so they can never desync.
   * The page-specific quote leads the rotation; if it isn't one of the
   * standard trust quotes it gets a neutral label. */
  const items = React.useMemo<readonly TrustQuote[]>(() => {
    const known = trustQuotes.find((item) => item.quote === quote);
    if (known) {
      return [known, ...trustQuotes.filter((item) => item !== known)];
    }
    return [{ quote, label: "Clausly" }, ...trustQuotes];
  }, [quote]);

  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mediaQuery.matches);

    function handleChange(event: MediaQueryListEvent) {
      setReduceMotion(event.matches);
    }

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  React.useEffect(() => {
    if (reduceMotion || paused || items.length <= 1) return undefined;
    const interval = window.setInterval(() => {
      setActive((value) => (value + 1) % items.length);
    }, ROTATE_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [items.length, paused, reduceMotion]);

  return (
    <div
      className="mt-7"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Fixed-height stage with cross-fading layers: no remount flash, no
       * layout shift as quotes of different lengths swap in. */}
      <div className="relative min-h-[148px] border-l-2 border-[var(--accent)] pl-5">
        {items.map((item, index) => (
          <div
            key={item.label + item.quote}
            aria-hidden={index !== active}
            className={cn(
              "absolute inset-y-0 left-5 right-0",
              "transition-[opacity,transform] duration-700 ease-[var(--ease-out-quart)]",
              "motion-reduce:transition-none",
              index === active
                ? "opacity-100 translate-y-0"
                : "pointer-events-none opacity-0 translate-y-1.5"
            )}
          >
            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--faint)]">
              {item.label}
            </p>
            <blockquote className="mt-3 font-serif text-[22px] leading-[1.35] text-[var(--accent-ink)]">
              &ldquo;{item.quote}&rdquo;
            </blockquote>
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <div className="mt-4 flex items-center gap-1.5 pl-5" role="tablist" aria-label="Clausly highlights">
          {items.map((item, index) => (
            <button
              key={item.label + item.quote}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={item.label}
              onClick={() => setActive(index)}
              className={cn(
                "h-1 rounded-full transition-all duration-500 ease-[var(--ease-out-quart)] motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]",
                index === active
                  ? "w-6 bg-[var(--accent)]"
                  : "w-2.5 bg-[var(--border-strong)] hover:bg-[var(--faint)]"
              )}
            />
          ))}
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-2.5">
        {trustSignals.map(({ icon: Icon, label }, index) => (
          <div
            key={label}
            className={cn(
              "rounded-[var(--radius-md)] border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_76%,transparent)]",
              "px-3.5 py-3 shadow-[var(--shadow-card)] backdrop-blur",
              !reduceMotion && "animate-auth-signal-in"
            )}
            style={{ animationDelay: reduceMotion ? undefined : `${index * 80}ms` }}
          >
            <Icon className="size-4 text-[var(--accent)]" />
            <p className="mt-2 text-[12.5px] leading-snug text-[var(--muted)]">
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
