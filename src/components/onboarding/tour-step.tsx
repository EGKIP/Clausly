"use client";

import { Button } from "@/components/ui/button";

export type TourStepContent = {
  target: string;
  title: string;
  body: string;
};

type TourStepProps = {
  step: TourStepContent;
  current: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
};

export function TourStep({ step, current, total, onNext, onSkip }: TourStepProps) {
  const isFinalStep = current === total - 1;

  return (
    <div
      className="pointer-events-auto w-[min(22rem,calc(100vw-2rem))] rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-[0_24px_80px_-32px_oklch(0%_0_0/0.45)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-step-title"
    >
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
          Step {current + 1} of {total}
        </p>
        <button
          type="button"
          onClick={onSkip}
          className="text-[12px] font-medium text-[var(--muted)] underline underline-offset-4 hover:text-[var(--foreground)]"
        >
          Skip
        </button>
      </div>
      <h2 id="tour-step-title" className="mt-4 font-serif text-2xl leading-none text-[var(--foreground)]">
        {step.title}
      </h2>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--muted)]">
        {step.body}
      </p>
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-[12px] text-[var(--faint)]">
          {current + 1}/{total}
        </span>
        <Button type="button" size="sm" onClick={onNext}>
          {isFinalStep ? "Done" : "Next"}
        </Button>
      </div>
    </div>
  );
}
