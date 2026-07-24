"use client";

import * as React from "react";
import { TourStep, type TourStepContent } from "./tour-step";

const TOUR_STEPS: TourStepContent[] = [
  {
    target: '[data-tour="upload"]',
    title: "Start with a contract",
    body: "Drop a PDF you've signed. Leases, NDAs, employment offers. We read all of them.",
  },
  {
    target: '[data-tour="documents"]',
    title: "Watch Clausly read",
    body: "Analysis takes ~30s. We extract clauses, dates, and risk. Click any contract to open it.",
  },
  {
    target: '[data-tour="clauses"]',
    title: "Skim the clauses",
    body: "Plain-English summaries of the parts that matter. Click one to see the source.",
  },
  {
    target: '[data-tour="reminders"]',
    title: "Approve a reminder",
    body: "We suggest reminders for renewals and deadlines. Nothing fires without your nod.",
  },
];

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function TourOverlay() {
  const [current, setCurrent] = React.useState(0);
  const [visible, setVisible] = React.useState(true);
  const [targetRect, setTargetRect] = React.useState<TargetRect | null>(null);
  const completedRef = React.useRef(false);
  const step = TOUR_STEPS[current];

  React.useEffect(() => {
    if (!visible) return;

    function updateTarget() {
      const target = document.querySelector<HTMLElement>(step.target);
      if (!target) {
        setTargetRect(null);
        return;
      }

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!prefersReducedMotion) {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }

      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }

    updateTarget();
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, { passive: true });
    return () => {
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget);
    };
  }, [step.target, visible]);

  if (!visible) return null;

  async function completeTour() {
    if (completedRef.current) return;
    completedRef.current = true;
    setVisible(false);
    await fetch("/api/onboarding/tour", { method: "POST" }).catch(() => null);
  }

  function handleNext() {
    if (current === TOUR_STEPS.length - 1) {
      void completeTour();
      return;
    }
    setCurrent((value) => value + 1);
  }

  return (
    <div className="fixed inset-0 z-[80] pointer-events-none" data-testid="tour-overlay">
      <div className="absolute inset-0 bg-[oklch(12%_0.02_255/0.58)]" />
      {targetRect && (
        <div
          aria-hidden="true"
          className="absolute rounded-[var(--radius-md)] ring-2 ring-[var(--accent)] ring-offset-4 ring-offset-[var(--background)] shadow-[0_0_0_9999px_oklch(12%_0.02_255/0.58)]"
          style={{
            top: Math.max(targetRect.top - 8, 8),
            left: Math.max(targetRect.left - 8, 8),
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}
      <div className="absolute inset-x-4 bottom-6 flex justify-center md:bottom-auto md:top-24">
        <div className="relative">
          <span className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rotate-45 border-l border-t border-[var(--border-strong)] bg-[var(--surface)]" />
          <TourStep
            step={step}
            current={current}
            total={TOUR_STEPS.length}
            onNext={handleNext}
            onSkip={() => void completeTour()}
          />
        </div>
      </div>
    </div>
  );
}
