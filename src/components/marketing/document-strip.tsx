"use client";

import { Container } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";

const docs = [
  "Apartment leases",
  "Employment agreements",
  "Service contracts",
  "Auto loans",
  "Insurance policies",
  "NDAs",
  "Vendor contracts",
  "Subscription terms",
  "Equipment leases",
  "Storage agreements",
  "Freelance contracts",
  "Renewal notices",
];

/* A quiet, marquee-style strip naming the kinds of documents Clausly
 * handles. Doubles as social proof without fabricating logos. */
export function DocumentStrip({ variant = "section" }: { variant?: "section" | "inline" }) {
  const row = [...docs, ...docs];
  const isInline = variant === "inline";
  if (isInline) {
    return (
      <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_72%,transparent)] px-4 py-3 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-4">
          <p className="hidden shrink-0 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--faint)] md:block">
            Built for everyday contracts
          </p>
          <div
            className="relative min-w-0 flex-1 overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
            }}
          >
            <div className="flex w-max animate-marquee gap-3">
              {row.map((d, i) => (
                <span
                  key={`${d}-${i}`}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-[12.5px] text-[var(--muted)] shadow-[0_1px_0_color-mix(in_oklch,var(--foreground)_4%,transparent)]"
                >
                  <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative py-10 md:py-14 border-y border-[var(--border)] bg-[var(--surface)]">
      <Container className="mb-6">
        <Reveal y={10}>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--faint)] text-center lg:text-left">
            Built for everyday contracts
          </p>
        </Reveal>
      </Container>

      <Reveal
        delay={0.08}
        y={10}
        className="relative overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
        }}
      >
        <div className="flex w-max animate-marquee gap-3">
          {row.map((d, i) => (
            <span
              key={`${d}-${i}`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-[13px] text-[var(--muted)] shadow-[0_1px_0_color-mix(in_oklch,var(--foreground)_4%,transparent)]"
            >
              <span className="size-1.5 rounded-full bg-[var(--accent)]" />
              {d}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
