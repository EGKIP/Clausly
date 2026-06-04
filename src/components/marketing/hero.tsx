"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { HeroVisual } from "./hero-visual";

export function Hero() {
  return (
    <section className="relative pt-32 md:pt-40 pb-20 md:pb-28 overflow-hidden">
      {/* Atmospheric background */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-fine mask-radial-fade opacity-[0.55]" />
        <div
          className="absolute left-1/2 -translate-x-1/2 top-[-10%] h-[640px] w-[1100px] rounded-full blur-3xl opacity-50"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklch, var(--accent) 30%, transparent), transparent 70%)",
          }}
        />
        <div
          className="absolute right-[-10%] top-[40%] h-[420px] w-[640px] rounded-full blur-3xl opacity-40"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklch, var(--color-ember) 35%, transparent), transparent 70%)",
          }}
        />
      </div>

      <Container>
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Copy block */}
          <div className="lg:col-span-7 max-w-[680px]">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.165, 0.84, 0.44, 1] }}
            >
              <Eyebrow>
                <Sparkles className="size-3" />
                Contract intelligence · v0.1 preview
              </Eyebrow>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.05, ease: [0.165, 0.84, 0.44, 1] }}
              className="mt-6 font-serif font-normal tracking-[-0.025em] text-balance text-[var(--foreground)] text-[clamp(2.75rem,6.6vw,5.5rem)] leading-[0.96]"
            >
              Finally understand{" "}
              <span className="italic text-[var(--accent-ink)]">
                what you signed.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.165, 0.84, 0.44, 1] }}
              className="mt-7 text-[17px] md:text-[18px] leading-[1.55] text-[var(--muted)] text-pretty max-w-[560px]"
            >
              Clausly turns leases, contracts, and agreements into clear summaries,
              surfaced clauses, and reminders you approve. The documents you signed,
              finally organised — not lost in a folder.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.165, 0.84, 0.44, 1] }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Button variant="primary" size="lg" href="/signup">
                Upload your first contract
                <ArrowRight className="size-4" />
              </Button>
              <Button variant="secondary" size="lg" href="/dashboard">
                Try the live demo
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12.5px] text-[var(--faint)]"
            >
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-[var(--accent)]" />
                Encrypted document storage
              </span>
              <span className="hidden md:inline">·</span>
              <span>Free for your first 5 documents</span>
              <span className="hidden md:inline">·</span>
              <span>No credit card required</span>
            </motion.div>
          </div>

          {/* Visual */}
          <div className="lg:col-span-5 lg:-mr-6 xl:-mr-12">
            <HeroVisual />
          </div>
        </div>
      </Container>

      {/* Subtle bottom edge to dissolve into next section */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, transparent, color-mix(in oklch, var(--background) 100%, transparent))",
        }}
      />
    </section>
  );
}
