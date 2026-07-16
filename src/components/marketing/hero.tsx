"use client";

import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { DocumentStrip } from "./document-strip";
import { HeroVisual } from "./hero-visual";

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-28 md:pb-24 md:pt-36">
      {/* Quiet background texture */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-fine mask-radial-fade opacity-[0.55]" />
        <div
          className="absolute inset-x-0 top-0 h-[720px] opacity-80"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklch, var(--accent) 14%, transparent), transparent 42%), linear-gradient(210deg, color-mix(in oklch, var(--color-ember) 12%, transparent), transparent 50%)",
          }}
        />
      </div>

      <Container>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: [0.165, 0.84, 0.44, 1] }}
          className="mb-8 md:mb-10"
        >
          <DocumentStrip variant="inline" />
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Copy block */}
          <div className="lg:col-span-7 max-w-[680px]">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.165, 0.84, 0.44, 1] }}
            >
              <Eyebrow>
                <FileTextIcon />
                Contract summaries, dates, and reminders
              </Eyebrow>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.05, ease: [0.165, 0.84, 0.44, 1] }}
              className="mt-6 font-serif font-normal text-balance text-[var(--foreground)] text-[clamp(2.55rem,5.4vw,4.7rem)] leading-[1]"
            >
              Know what you signed.{" "}
              <span className="italic text-[var(--accent-ink)]">
                Remember what matters.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.165, 0.84, 0.44, 1] }}
              className="mt-5 text-[16.5px] md:text-[17.5px] leading-[1.5] text-[var(--muted)] text-pretty max-w-[560px]"
            >
              Upload a lease, contract, or policy. Clausly pulls out the summary,
              important clauses, dates, and reminders you choose to approve.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.165, 0.84, 0.44, 1] }}
              className="mt-7 flex flex-wrap items-center gap-3"
            >
              <Button variant="primary" size="lg" href="/signup">
                Start with one PDF
                <ArrowRight className="size-4" />
              </Button>
              <Button variant="secondary" size="lg" href="#preview">
                See the product
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12.5px] text-[var(--faint)]"
            >
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-[var(--accent)]" />
                Encrypted document storage
              </span>
              <span className="hidden md:inline">·</span>
              <span>Free for 5 documents</span>
              <span className="hidden md:inline">·</span>
              <span>Informational, not legal advice</span>
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

function FileTextIcon() {
  return (
    <span className="inline-flex size-3 items-center justify-center rounded-[3px] border border-current/40">
      <span className="h-1.5 w-1 rounded-[1px] bg-current" />
    </span>
  );
}
