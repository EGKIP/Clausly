"use client";

import * as React from "react";
import { Check, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Container, Eyebrow, Headline, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

type Cycle = "monthly" | "yearly";

const tiers = [
  {
    id: "free",
    name: "Free",
    tagline: "For your first contracts.",
    price: { monthly: 0, yearly: 0 },
    cta: { label: "Start free", href: "/signup" },
    features: [
      "Up to 5 stored documents",
      "Summaries and clause extraction",
      "Basic risk labels",
      "Suggested reminders, you approve",
      "Email reminders",
      "Document Q&A: 25 questions / day",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For everything you've signed.",
    price: { monthly: 12, yearly: 9 },
    highlight: true,
    cta: { label: "Upgrade to Pro", href: "/upgrade" },
    features: [
      "Unlimited documents",
      "Deeper analysis and long summaries",
      "Full risk insights with explanations",
      "Document Q&A: 250 questions / day",
      "Weekly insights · Monthly contract health",
      "Priority processing",
      "Cross-document search",
      "Exportable summaries and clause data",
    ],
  },
];

export function Pricing() {
  const [cycle, setCycle] = React.useState<Cycle>("yearly");
  return (
    <section id="pricing" className="relative py-24 md:py-32">
      <Container>
        <div className="max-w-2xl mx-auto text-center mb-12">
          <Reveal>
            <Eyebrow>Pricing</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <Headline className="mt-5">
              Free for what you signed last month.{" "}
              <span className="italic text-[var(--accent-ink)]">
                Pro for everything else.
              </span>
            </Headline>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 text-[16px] leading-relaxed text-[var(--muted)]">
              No credit card to start. Cancel any time. Pricing is in USD.
            </p>
          </Reveal>

          {/* Cycle toggle */}
          <Reveal delay={0.15}>
            <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-card)]">
              {(["monthly", "yearly"] as Cycle[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  className={cn(
                    "relative inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
                    cycle === c ? "text-[var(--background)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  {cycle === c && (
                    <motion.span
                      layoutId="cycle-pill"
                      className="absolute inset-0 rounded-full bg-[var(--foreground)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative capitalize">{c}</span>
                  {c === "yearly" && (
                    <span
                      className={cn(
                        "relative inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-mono",
                        cycle === c
                          ? "bg-[color-mix(in_oklch,var(--background)_30%,transparent)] text-[var(--background)]"
                          : "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                      )}
                    >
                      −25%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {tiers.map((t) => (
            <Reveal key={t.id} delay={t.highlight ? 0.1 : 0.05}>
              <div
                className={cn(
                  "relative h-full rounded-[var(--radius-2xl)] p-7 md:p-8 flex flex-col",
                  t.highlight
                    ? "border border-[color-mix(in_oklch,var(--accent)_45%,var(--border))] bg-[var(--surface)] shadow-[var(--shadow-float)]"
                    : "border border-[var(--border)] bg-[var(--surface-2)]"
                )}
              >
                {t.highlight && (
                  <>
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-[var(--radius-2xl)] opacity-60"
                      style={{
                        background:
                          "radial-gradient(120% 60% at 50% -10%, color-mix(in oklch, var(--accent) 18%, transparent), transparent 60%)",
                      }}
                    />
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge tone="clause" className="px-3 py-1 text-[11px]">
                        <Sparkles className="size-2.5" />
                        Recommended
                      </Badge>
                    </div>
                  </>
                )}

                <div className="relative">
                  <h3 className="font-serif text-[30px] leading-none tracking-[-0.015em]">{t.name}</h3>
                  <p className="mt-2 text-[14px] text-[var(--muted)]">{t.tagline}</p>

                  <div className="mt-6 flex items-baseline gap-1.5">
                    <span className="font-serif text-[56px] leading-none tracking-[-0.025em]">
                      ${t.price[cycle]}
                    </span>
                    <span className="text-[14px] text-[var(--muted)]">
                      {t.price[cycle] === 0 ? "forever" : `/ ${cycle === "yearly" ? "mo, billed yearly" : "month"}`}
                    </span>
                  </div>

                  <div className="mt-6">
                    <Button
                      variant={t.highlight ? "accent" : "secondary"}
                      size="lg"
                      href={t.cta.href}
                      className="w-full"
                    >
                      {t.cta.label}
                    </Button>
                  </div>

                  <ul className="mt-7 space-y-3">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[14px]">
                        <span
                          className={cn(
                            "mt-0.5 inline-flex size-[18px] shrink-0 items-center justify-center rounded-full",
                            t.highlight
                              ? "bg-[var(--accent)] text-white"
                              : "bg-[var(--surface)] text-[var(--accent)] border border-[var(--border)]"
                          )}
                        >
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                        <span className="text-[var(--foreground)]">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-10 text-center text-[12.5px] text-[var(--faint)]">
          Clausly is informational only and is not legal advice.
        </p>
      </Container>
    </section>
  );
}
