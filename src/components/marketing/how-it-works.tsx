"use client";

import { motion } from "framer-motion";
import { Upload, BrainCircuit, MousePointerClick, BellRing } from "lucide-react";
import { Container, Eyebrow, Headline, IconBadge } from "@/components/ui/primitives";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/reveal";

const steps = [
  {
    n: "01",
    icon: Upload,
    title: "Upload the PDF",
    body: "Drop in a lease, contract, or agreement. Stored privately, never used for training.",
  },
  {
    n: "02",
    icon: BrainCircuit,
    title: "Clausly reads it",
    body: "A clear summary, the clauses that matter, the dates that matter, the risks that matter.",
  },
  {
    n: "03",
    icon: MousePointerClick,
    title: "Approve what's useful",
    body: "Edit or accept suggested reminders. Ignore the noise. Nothing fires without your nod.",
  },
  {
    n: "04",
    icon: BellRing,
    title: "Get reminded — on time",
    body: "Email reminders at the timing you chose. Open the document with one click.",
  },
];

export function HowItWorks() {
  return (
    <section className="relative py-24 md:py-32 bg-[var(--surface-2)] border-y border-[var(--border)]">
      <Container>
        <div className="max-w-2xl mb-14">
          <Reveal>
            <Eyebrow>How it works</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <Headline className="mt-5">
              Four steps. About two minutes per contract.
            </Headline>
          </Reveal>
        </div>

        <Stagger className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Connector for desktop */}
          <div aria-hidden className="hidden lg:block absolute left-8 right-8 top-[58px] h-px">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: "left" }}
              className="h-full w-full"
            >
              <div
                className="h-full w-full"
                style={{
                  background:
                    "repeating-linear-gradient(to right, var(--border-strong) 0 6px, transparent 6px 12px)",
                }}
              />
            </motion.div>
          </div>

          {steps.map((s) => (
            <StaggerItem key={s.n}>
              <div className="relative h-full rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 md:p-7 flex flex-col">
                <div className="flex items-center justify-between">
                  <IconBadge tone="clause" size="lg">
                    <s.icon />
                  </IconBadge>
                  <span className="font-serif text-[44px] leading-none text-[var(--ink-line,var(--border))] tracking-[-0.04em] italic">
                    {s.n}
                  </span>
                </div>
                <h3 className="mt-5 font-serif text-[22px] leading-[1.15] tracking-[-0.01em]">
                  {s.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">
                  {s.body}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </section>
  );
}
