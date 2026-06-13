import * as React from "react";
import { cn } from "@/lib/utils";

/* ── Skeleton ───────────────────────────────────────────────────────────
   Loading placeholder with a subtle shimmer. Honors prefers-reduced-motion
   via the `motion-safe:` variant. Use `variant` for common shapes or pass
   custom sizing classes.
   ─────────────────────────────────────────────────────────────────── */

type Variant = "line" | "block" | "circle" | "pill";

export function Skeleton({
  variant = "line",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden bg-[var(--surface-2)] motion-safe:animate-skeleton-shimmer",
        variant === "line" && "h-3.5 rounded-full",
        variant === "block" && "rounded-[var(--radius-md)]",
        variant === "circle" && "rounded-full aspect-square",
        variant === "pill" && "h-6 rounded-full",
        className
      )}
      {...props}
    />
  );
}

/* ── SkeletonText ───────────────────────────────────────────────────────
   Stack of line skeletons with a slightly shorter final line, mimicking
   real paragraph rag. Default 3 lines.
   ─────────────────────────────────────────────────────────────────── */

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}
