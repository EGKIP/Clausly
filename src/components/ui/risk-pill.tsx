import { cn } from "@/lib/utils";

export type RiskLevel = "Low" | "Medium" | "High" | "Needs Review";

const styles: Record<RiskLevel, { dot: string; bg: string; text: string }> = {
  Low: {
    dot: "bg-[var(--color-clause)]",
    bg: "bg-[var(--color-clause-soft)]",
    text: "text-[var(--color-clause-ink)]",
  },
  Medium: {
    dot: "bg-[var(--color-ember)]",
    bg: "bg-[var(--color-ember-soft)]",
    text: "text-[var(--color-ember-ink)]",
  },
  High: {
    dot: "bg-[var(--color-coral)]",
    bg: "bg-[var(--color-coral-soft)]",
    text: "text-[var(--color-coral-ink)]",
  },
  "Needs Review": {
    dot: "bg-[var(--color-iris)]",
    bg: "bg-[var(--color-iris-soft)]",
    text: "text-[var(--color-iris)]",
  },
};

export function RiskPill({
  level,
  size = "md",
  className,
}: {
  level: RiskLevel;
  size?: "sm" | "md";
  className?: string;
}) {
  const s = styles[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        s.bg,
        s.text,
        size === "sm" ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11.5px]",
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {level} risk
    </span>
  );
}
