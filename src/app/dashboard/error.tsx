"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/* Route-level error boundary for the dashboard: a data fetch that throws in
 * a server component lands here instead of Next's unstyled default screen.
 * Documents themselves are unaffected — this is a page-load failure, not a
 * data-loss state, so the copy stays calm and offers a retry. */
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-[480px] rounded-[var(--radius-lg)] border border-[color-mix(in_oklch,var(--color-coral)_25%,var(--border))] bg-[var(--color-coral-soft)] p-8">
        <span className="inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface)] text-[var(--color-coral-ink)]">
          <TriangleAlert className="size-4" />
        </span>
        <h1 className="mt-4 font-serif text-[26px] leading-tight tracking-[-0.01em] text-[var(--foreground)]">
          This page didn&apos;t load.
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--foreground)] opacity-80">
          Something went wrong while loading your workspace. Your documents are
          safe. This is a loading problem, not a data problem.
        </p>
        <div className="mt-5">
          <Button variant="primary" size="sm" onClick={reset}>
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
