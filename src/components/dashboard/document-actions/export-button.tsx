"use client";

import * as React from "react";
import { Download, FileArchive, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ExportUsage } from "@/lib/exports/limits";
import { cn } from "@/lib/utils";

type ExportFormat = "pdf" | "csv";

export function ExportButton({
  documentId,
  usage,
}: {
  documentId: string;
  usage: ExportUsage;
}) {
  const [open, setOpen] = React.useState(false);
  const [currentUsage, setCurrentUsage] = React.useState(usage);
  const [status, setStatus] = React.useState<"idle" | "loading">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const disabled = currentUsage.remaining <= 0;

  async function download(format: ExportFormat) {
    if (disabled) {
      toast.error("Export limit reached. Upgrade to Pro for unlimited exports.");
      return;
    }

    setStatus("loading");
    setError(null);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/export?format=${format}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Export failed." }));
        if (response.status === 429 && isExportLimitBody(body)) {
          setCurrentUsage({
            used: body.used,
            limit: body.limit,
            remaining: 0,
            plan: body.plan,
            resetsAt: body.resetsAt,
          });
        }
        const message = typeof body.error === "string" ? body.error : "Export failed.";
        setError(message);
        toast.error(message);
        return;
      }

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = filenameFromDisposition(response.headers.get("Content-Disposition")) ?? `clausly-export.${format}`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      setOpen(false);
      toast.success("Export ready.");
      setCurrentUsage((next) => next.plan === "free"
        ? { ...next, used: next.used + 1, remaining: Math.max(next.remaining - 1, 0) }
        : next);
    } catch (downloadError) {
      const message = downloadError instanceof Error ? downloadError.message : "Export failed.";
      setError(message);
      toast.error(message);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        aria-label="Export document"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        title={disabled ? "Free plan export limit reached" : "Export document"}
      >
        <Download className="size-3.5" /> Export
      </Button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[260px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-float)]">
          <ExportOption
            icon={FileText}
            title="PDF digest"
            description="Summary, clauses, dates, and reminders."
            disabled={status === "loading"}
            onClick={() => void download("pdf")}
          />
          <ExportOption
            icon={FileArchive}
            title="CSV zip"
            description="clauses.csv and dates.csv for analysis."
            disabled={status === "loading"}
            onClick={() => void download("csv")}
          />
          <div className="border-t border-[var(--border)] px-3 py-2">
            <p className="text-[11.5px] leading-relaxed text-[var(--muted)]">
              {usageLabel(currentUsage)}
            </p>
            {error && (
              <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-coral-ink)]">
                {error}{" "}
                {currentUsage.plan === "free" && (
                  <a href="/upgrade" className="underline underline-offset-2">
                    Upgrade to Pro
                  </a>
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ExportOption({
  icon: Icon,
  title,
  description,
  disabled,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-left transition-colors",
        disabled ? "cursor-wait opacity-60" : "hover:bg-[var(--surface-2)]"
      )}
    >
      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent-soft)] text-[var(--accent-ink)]">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-[var(--foreground)]">{title}</span>
        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-[var(--muted)]">{description}</span>
      </span>
    </button>
  );
}

function usageLabel(usage: ExportUsage) {
  if (usage.plan === "pro") return "Unlimited exports included with Pro.";
  return `${usage.used} of ${usage.limit} exports used this month.`;
}

function filenameFromDisposition(value: string | null) {
  const match = value?.match(/filename="([^"]+)"/);
  return match?.[1] ?? null;
}

function isExportLimitBody(value: unknown): value is {
  used: number;
  limit: number;
  plan: "free" | "pro";
  resetsAt: string;
  error?: string;
} {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.used === "number"
    && typeof body.limit === "number"
    && (body.plan === "free" || body.plan === "pro")
    && typeof body.resetsAt === "string";
}
