"use client";

import * as React from "react";
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
  const [active, setActive] = React.useState(0);
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const quotes = React.useMemo(
    () => [quote, ...trustQuotes.map((item) => item.quote).filter((item) => item !== quote)],
    [quote]
  );

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
    if (reduceMotion || quotes.length <= 1) return undefined;
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
        <blockquote
          key={quotes[active]}
          className={cn(
            "mt-3 font-serif text-[22px] leading-[1.35] text-[var(--accent-ink)]",
            !reduceMotion && "animate-auth-quote-in"
          )}
        >
          &ldquo;{quotes[active]}&rdquo;
        </blockquote>
      </div>

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
