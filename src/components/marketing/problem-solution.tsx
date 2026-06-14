"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  AlertTriangle,
  CalendarX,
  Inbox,
  Search,
  CheckCircle2,
  BellRing,
  Sparkles,
  FolderOpen,
} from "lucide-react";
import { Container, Eyebrow, Headline, IconBadge } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";

const problems = [
  { icon: CalendarX, label: "Lease ends. You forgot to give 60-day notice." },
  { icon: AlertTriangle, label: "Auto-renewal kicked in for another year." },
  { icon: Inbox, label: "Contracts scattered across email, Drive, and a drawer." },
  { icon: Search, label: "Need that one clause. Spend an hour scrolling a PDF." },
];

const solutions = [
  { icon: Sparkles, label: "Clausly reads it the day you upload it." },
  { icon: BellRing, label: "Reminders you approve, not surprises." },
  { icon: FolderOpen, label: "One portfolio for every contract you've signed." },
  { icon: CheckCircle2, label: "Find any clause in seconds. With page references." },
];

export function ProblemSolution() {
  const reduce = useReducedMotion();
  const listVariants: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.06, delayChildren: 0.1 },
    },
  };
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.165, 0.84, 0.44, 1] },
    },
  };
  return (
    <section className="relative py-24 md:py-32">
      <Container>
        <div className="max-w-2xl">
          <Reveal>
            <Eyebrow>The problem</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <Headline className="mt-5">
              Most people don&apos;t{" "}
              <span className="italic text-[var(--color-coral-ink)]">read</span>{" "}
              the contracts they sign. <br className="hidden md:block" />
              And no one tracks them after.
            </Headline>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-[16.5px] leading-relaxed text-[var(--muted)] max-w-xl">
              Renewal windows close. Late-fee clauses you never noticed kick in.
              The PDF you signed last March is in a folder you can&apos;t find.
              It&apos;s not negligence — contracts are designed to be skimmed once,
              and forgotten.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid lg:grid-cols-2 gap-6 lg:gap-10 items-stretch">
          {/* Without Clausly */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: [0.165, 0.84, 0.44, 1] }}
            className="relative rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-2)] p-7 md:p-9 overflow-hidden"
          >
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--faint)]">
              Without Clausly
            </span>
            <h3 className="mt-3 font-serif text-[26px] leading-tight tracking-[-0.01em]">
              A folder full of things you forgot.
            </h3>
            <motion.ul
              variants={listVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="mt-7 space-y-3.5"
            >
              {problems.map(({ icon: Icon, label }) => (
                <motion.li
                  key={label}
                  variants={itemVariants}
                  className="flex items-start gap-3"
                >
                  <IconBadge tone="coral" size="sm">
                    <Icon />
                  </IconBadge>
                  <span className="text-[14.5px] leading-relaxed text-[var(--ink-soft,var(--foreground))] pt-1.5">
                    {label}
                  </span>
                </motion.li>
              ))}
            </motion.ul>

            {/* faint failed-document doodle */}
            <div
              aria-hidden
              className="absolute -bottom-6 -right-6 size-40 rounded-full blur-3xl opacity-30"
              style={{
                background:
                  "radial-gradient(closest-side, var(--color-coral), transparent)",
              }}
            />
          </motion.div>

          {/* With Clausly */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.165, 0.84, 0.44, 1] }}
            className="relative rounded-[var(--radius-xl)] border border-[color-mix(in_oklch,var(--accent)_30%,var(--border))] bg-[var(--surface)] p-7 md:p-9 overflow-hidden shadow-[var(--shadow-card)]"
          >
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--accent-ink)]">
              With Clausly
            </span>
            <h3 className="mt-3 font-serif text-[26px] leading-tight tracking-[-0.01em]">
              A portfolio that reads itself.
            </h3>
            <motion.ul
              variants={listVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="mt-7 space-y-3.5"
            >
              {solutions.map(({ icon: Icon, label }) => (
                <motion.li
                  key={label}
                  variants={itemVariants}
                  className="flex items-start gap-3"
                >
                  <IconBadge tone="clause" size="sm">
                    <Icon />
                  </IconBadge>
                  <span className="text-[14.5px] leading-relaxed text-[var(--foreground)] pt-1.5">
                    {label}
                  </span>
                </motion.li>
              ))}
            </motion.ul>

            <div
              aria-hidden
              className="absolute -bottom-6 -right-6 size-40 rounded-full blur-3xl opacity-40"
              style={{
                background:
                  "radial-gradient(closest-side, var(--accent), transparent)",
              }}
            />
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
