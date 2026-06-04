"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";

export function FinalCTA() {
  return (
    <section className="relative py-24 md:py-32">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border-strong)] bg-[var(--foreground)] text-[var(--background)] px-7 md:px-14 py-16 md:py-20">
            {/* Atmosphere */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-50"
              style={{
                background:
                  "radial-gradient(60% 60% at 10% 0%, color-mix(in oklch, var(--accent) 65%, transparent), transparent 60%), radial-gradient(50% 60% at 90% 100%, color-mix(in oklch, var(--color-ember) 55%, transparent), transparent 60%)",
              }}
            />
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, var(--background) 1px, transparent 1px), linear-gradient(to bottom, var(--background) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
                maskImage:
                  "radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 100%)",
              }}
            />

            <div className="relative grid lg:grid-cols-[1.4fr_1fr] gap-8 items-end">
              <div>
                <Eyebrow variant="subtle" className="bg-white/10 text-white/80 border border-white/10">
                  <Sparkles className="size-3" />
                  Ready when you are
                </Eyebrow>
                <h2 className="mt-5 font-serif text-[clamp(2.25rem,5vw,4.25rem)] leading-[1.02] tracking-[-0.02em] text-balance">
                  Upload one contract.{" "}
                  <span className="italic opacity-80">See the difference in 60 seconds.</span>
                </h2>
                <p className="mt-5 max-w-xl text-[16px] leading-relaxed opacity-70">
                  No credit card. No setup. Drag in a PDF and Clausly does the rest.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-end">
                <Button
                  variant="accent"
                  size="xl"
                  href="/signup"
                  className="w-full lg:w-auto"
                >
                  Get started, free
                  <ArrowRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="xl"
                  href="/dashboard"
                  className="w-full lg:w-auto border-white/20 text-white hover:bg-white/10"
                >
                  Try the live demo
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
