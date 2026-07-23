"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";
import { Plus } from "lucide-react";
import { Container, Eyebrow, Headline } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Is Clausly a lawyer or legal advice service?",
    a: "No. Clausly is a contract organisation and document intelligence tool. It helps you understand and track documents you've signed. It is not a law firm, does not create an attorney-client relationship, and does not provide legal advice. For interpretation of legal terms, consult a licensed attorney in your jurisdiction.",
  },
  {
    q: "How does Clausly handle my documents?",
    a: "Your PDFs are stored privately in encrypted object storage. Only you can access them. Documents are used to generate analysis for your account and are not used to train AI models. You can delete any document at any time, which removes it from both active storage and our database references.",
  },
  {
    q: "What file types are supported?",
    a: "PDF for the v0.1 release. Native-text PDFs and scanned PDFs are both supported. Scanned documents are routed through OCR. We're evaluating DOCX, TXT, and pasted-text support for later releases.",
  },
  {
    q: "How accurate is the AI?",
    a: "Clausly is built around the assumption that AI is helpful but fallible. Every extracted clause includes the source quote and page reference so you can verify it. Reminders are always suggested first and must be approved by you. Nothing fires on its own.",
  },
  {
    q: "What's the difference between Free and Pro?",
    a: "Free lets you store up to 5 documents with AI summaries, clause extraction, suggested reminders, and email reminders. That is plenty to evaluate the product on your real contracts. Pro lifts the storage limit, unlocks advanced analysis, unlimited Q&A, and adds weekly + monthly insight reports across your portfolio.",
  },
  {
    q: "Will you remind me by SMS or push notifications?",
    a: "v0.1 sends email reminders only. SMS and push notifications are on the roadmap but not yet active. You will always see upcoming reminders on the dashboard regardless of channel.",
  },
  {
    q: "Can I export my data?",
    a: "Yes. Your documents remain yours. You can download any uploaded PDF and your structured data (clauses, dates, reminders) is exportable. Calendar export for approved reminders is rolling out for Pro.",
  },
  {
    q: "Does state or jurisdiction matter?",
    a: "Clausly stores a default jurisdiction on your profile and a per-document jurisdiction, because a Minnesota resident might sign a contract governed by California law. This is used as context only. Clausly does not draw strong legal conclusions from state law.",
  },
];

export function FAQ() {
  const [open, setOpen] = React.useState<number | null>(0);
  const reduce = useReducedMotion();
  const listVariants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
  };
  const rowVariants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.165, 0.84, 0.44, 1] },
    },
  };
  return (
    <section id="faq" className="relative py-24 md:py-32">
      <Container>
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <Reveal>
              <Eyebrow>FAQ</Eyebrow>
            </Reveal>
            <Reveal delay={0.05}>
              <Headline className="mt-5">
                The honest{" "}
                <span className="italic text-[var(--accent-ink)]">small print</span>.
              </Headline>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 text-[15.5px] leading-relaxed text-[var(--muted)]">
                Clausly handles sensitive documents. We want to be precise about what
                it is and what it isn&apos;t.
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-8">
            <motion.ul
              variants={listVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] overflow-hidden"
            >
              {faqs.map((f, i) => {
                const isOpen = open === i;
                return (
                  <motion.li key={f.q} variants={rowVariants}>
                    <button
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between gap-4 px-5 md:px-6 py-5 text-left group"
                    >
                      <span
                        className={cn(
                          "font-medium text-[15px] md:text-[16px] leading-snug transition-colors",
                          isOpen ? "text-[var(--foreground)]" : "text-[var(--foreground)]"
                        )}
                      >
                        {f.q}
                      </span>
                      <span
                        className={cn(
                          "inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] transition-transform duration-300",
                          isOpen && "rotate-45 bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                        )}
                      >
                        <Plus className="size-3.5" />
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: [0.165, 0.84, 0.44, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="px-5 md:px-6 pb-6 pr-12 text-[14.5px] leading-relaxed text-[var(--muted)] text-pretty">
                            {f.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </motion.ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
