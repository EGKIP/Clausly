import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--faint)] mb-2">
            {eyebrow}
          </p>
        )}
        <h1 className="font-serif text-[clamp(1.85rem,2.8vw,2.6rem)] leading-[1.05] tracking-[-0.015em] text-balance">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-[var(--muted)]">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}

/* ── Page-level container for vertical rhythm ───────────────────────── */
export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-4 md:px-8 py-8 md:py-10 max-w-[1320px] mx-auto", className)}>
      {children}
    </div>
  );
}

/* ── Inline section header (for groups within a page) ───────────────── */
export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4 mb-4", className)}>
      <div className="min-w-0">
        <h2 className="font-serif text-[20px] md:text-[22px] leading-tight tracking-[-0.01em]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[12.5px] text-[var(--muted)]">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
