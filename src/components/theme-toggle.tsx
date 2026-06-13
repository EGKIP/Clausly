"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── ThemeToggle ────────────────────────────────────────────────────────
   Three-state segmented control: system / light / dark. Renders an inert
   shell on the server to avoid hydration mismatch (next-themes pattern).
   ─────────────────────────────────────────────────────────────────── */

type Mode = "system" | "light" | "dark";
const modes: { id: Mode; label: string; icon: React.ElementType }[] = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

/* Compact icon button that flips between light and dark. Use in topbars
   and dense surfaces where a 3-state control would crowd the layout. */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const next = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      aria-label={mounted ? `Switch to ${next} mode` : "Toggle theme"}
      title={mounted ? `Switch to ${next} mode` : "Toggle theme"}
      onClick={() => setTheme(next)}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors",
        className
      )}
    >
      {mounted && isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const current = (mounted ? theme : "system") as Mode;

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={cn(
        "inline-flex items-center gap-0.5 p-0.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)]",
        className
      )}
    >
      {modes.map((m) => {
        const active = current === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={m.label}
            title={m.label}
            onClick={() => setTheme(m.id)}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-[var(--radius-xs)] transition-colors",
              active
                ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            <m.icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
