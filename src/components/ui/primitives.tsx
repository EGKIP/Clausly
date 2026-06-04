import * as React from "react";
import { cn } from "@/lib/utils";

/* ── Container ──────────────────────────────────────────────────────── */
export function Container({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1240px] px-6 md:px-8", className)}
      {...props}
    />
  );
}

/* ── Section wrapper with vertical rhythm ───────────────────────────── */
export function Section({
  className,
  id,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      id={id}
      className={cn("relative py-24 md:py-32", className)}
      {...props}
    >
      {children}
    </section>
  );
}

/* ── Eyebrow label ──────────────────────────────────────────────────── */
export function Eyebrow({
  children,
  className,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "outline" | "subtle";
}) {
  const styles = {
    default:
      "bg-[var(--accent-soft)] text-[var(--accent-ink)] border border-[color-mix(in_oklch,var(--accent)_25%,transparent)]",
    outline:
      "border border-[var(--border-strong)] text-[var(--muted)] bg-[var(--surface)]",
    subtle: "bg-[var(--surface-2)] text-[var(--muted)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] tracking-[0.12em] uppercase",
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ── Section heading (display serif) ────────────────────────────────── */
export function Headline({
  level = 2,
  children,
  className,
}: {
  level?: 1 | 2 | 3;
  children: React.ReactNode;
  className?: string;
}) {
  const Tag = (`h${level}` as unknown) as React.ElementType;
  const sizes = {
    1: "text-[clamp(2.75rem,6.2vw,5.5rem)] leading-[0.98]",
    2: "text-[clamp(2rem,4.4vw,3.75rem)] leading-[1.02]",
    3: "text-[clamp(1.5rem,2.4vw,2.25rem)] leading-[1.1]",
  };
  return (
    <Tag
      className={cn(
        "font-serif font-normal tracking-[-0.02em] text-balance",
        sizes[level],
        className
      )}
    >
      {children}
    </Tag>
  );
}

/* ── Card ───────────────────────────────────────────────────────────── */
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]",
        className
      )}
      {...props}
    />
  );
}

/* ── Badge ──────────────────────────────────────────────────────────── */
type BadgeTone = "neutral" | "clause" | "ember" | "coral" | "iris" | "outline";
export function Badge({
  children,
  tone = "neutral",
  className,
  ...props
}: { children: React.ReactNode; tone?: BadgeTone } & React.HTMLAttributes<HTMLSpanElement>) {
  const tones: Record<BadgeTone, string> = {
    neutral: "bg-[var(--surface-2)] text-[var(--foreground)]",
    clause: "bg-[var(--color-clause-soft)] text-[var(--color-clause-ink)]",
    ember: "bg-[var(--color-ember-soft)] text-[var(--color-ember-ink)]",
    coral: "bg-[var(--color-coral-soft)] text-[var(--color-coral-ink)]",
    iris: "bg-[var(--color-iris-soft)] text-[var(--color-iris)]",
    outline: "border border-[var(--border)] text-[var(--muted)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        tones[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/* ── Icon Badge: small framed icon container ────────────────────────── */
export function IconBadge({
  children,
  tone = "neutral",
  size = "md",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "clause" | "ember" | "coral" | "iris";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tones = {
    neutral: "bg-[var(--surface-2)] text-[var(--foreground)] border-[var(--border)]",
    clause: "bg-[var(--color-clause-soft)] text-[var(--color-clause-ink)] border-[color-mix(in_oklch,var(--color-clause)_20%,transparent)]",
    ember: "bg-[var(--color-ember-soft)] text-[var(--color-ember-ink)] border-[color-mix(in_oklch,var(--color-ember)_25%,transparent)]",
    coral: "bg-[var(--color-coral-soft)] text-[var(--color-coral-ink)] border-[color-mix(in_oklch,var(--color-coral)_25%,transparent)]",
    iris: "bg-[var(--color-iris-soft)] text-[var(--color-iris)] border-[color-mix(in_oklch,var(--color-iris)_25%,transparent)]",
  };
  const sizes = {
    sm: "size-7 rounded-[var(--radius-xs)] [&>svg]:size-3.5",
    md: "size-10 rounded-[var(--radius-sm)] [&>svg]:size-[18px]",
    lg: "size-12 rounded-[var(--radius-md)] [&>svg]:size-[22px]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center border",
        tones[tone],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ── Subtle divider with optional centered glyph ────────────────────── */
export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 h-px bg-[var(--border)]", className)} />;
}
