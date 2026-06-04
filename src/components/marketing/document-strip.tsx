"use client";

import { Container } from "@/components/ui/primitives";

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
export function DocumentStrip() {
  const row = [...docs, ...docs];
  return (
    <section className="relative py-10 md:py-14 border-y border-[var(--border)] bg-[var(--surface)]">
      <Container className="mb-6">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--faint)] text-center">
          Built for the documents that quietly run your life
        </p>
      </Container>

      <div
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
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-[13px] text-[var(--muted)]"
            >
              <span className="size-1.5 rounded-full bg-[var(--accent)]" />
              {d}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
