"use client";

import * as React from "react";
import { BarChart3, CalendarClock, FileSearch, Sparkles } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

const benefits = [
  {
    icon: BarChart3,
    title: "Weekly portfolio intelligence",
    description: "Spot spend, renewal pressure, and contracts that need attention.",
  },
  {
    icon: CalendarClock,
    title: "Deadline and notice-window digest",
    description: "See upcoming dates across the whole portfolio in one calm read.",
  },
  {
    icon: FileSearch,
    title: "Priority processing",
    description: "Move contract analysis through the queue faster as the portfolio grows.",
  },
];

export function InsightsUpgradeCard() {
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = React.useState<string | null>(null);

  async function startCheckout() {
    setStatus("loading");
    setMessage(null);

    const response = await fetch("/api/billing/checkout", { method: "POST" });
    const payload = await response.json().catch(() => ({ error: "Checkout could not be started." }));
    if (!response.ok || typeof payload.url !== "string") {
      setStatus("error");
      setMessage(payload.error ?? "Checkout could not be started.");
      return;
    }

    window.location.assign(payload.url);
  }

  return (
    <Card className="mt-10 overflow-hidden p-7 md:p-9">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <Badge tone="iris">
            <Sparkles className="size-2.5" /> Pro · Insights
          </Badge>
          <h2 className="mt-5 font-serif text-[clamp(2rem,4vw,3.35rem)] leading-[1.02] tracking-[-0.01em]">
            Unlock weekly contract intelligence.
          </h2>
          <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-[var(--muted)]">
            Pro turns your portfolio into a recurring read on spend, risk, renewals,
            and notice windows. Clausly keeps it informational only, never legal advice.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => void startCheckout()}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Opening checkout..." : "Upgrade to Pro"}
          </Button>
          {status === "error" && message && (
            <p className="max-w-[260px] text-right text-[12px] text-[var(--color-coral-ink)]">
              {message}
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {benefits.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4"
          >
            <Icon className="size-4 text-[var(--accent)]" />
            <p className="mt-3 text-[13.5px] font-medium">{title}</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--muted)]">
              {description}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
