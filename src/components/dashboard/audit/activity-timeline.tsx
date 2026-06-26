"use client";

import * as React from "react";
import Link from "next/link";
import {
  BellRing,
  CreditCard,
  FileText,
  History,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  Share2,
} from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Json } from "@/lib/supabase/types";

export type AuditTimelineEvent = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Json;
  createdAt: string;
};

type AuditResponse = {
  events: AuditTimelineEvent[];
  nextCursor: string | null;
};

const actionLabels: Record<string, string> = {
  "document.uploaded": "Uploaded a document",
  "document.deleted": "Deleted a document",
  "reminder.approved": "Approved a reminder",
  "reminder.dismissed": "Dismissed a reminder",
  "reminder.fired": "Sent a reminder",
  "conversation.created": "Started an Ask Clausly chat",
  "subscription.upgraded": "Upgraded to Pro",
  "subscription.cancelled": "Returned to Free",
  "share.created": "Created a share link",
  "share.revoked": "Revoked a share link",
  "export.created": "Exported a document",
  "account.deleted": "Deleted account",
};

type FilterId = "all" | "documents" | "reminders" | "account" | "billing";

const filters: Array<{ id: FilterId; label: string; resourceTypes: string[] }> = [
  { id: "all", label: "All", resourceTypes: [] },
  { id: "documents", label: "Documents", resourceTypes: ["document", "document_export", "document_share"] },
  { id: "reminders", label: "Reminders", resourceTypes: ["reminder"] },
  { id: "account", label: "Account", resourceTypes: ["account", "qa_conversation"] },
  { id: "billing", label: "Billing", resourceTypes: ["subscription"] },
];

export function ActivityTimeline({
  initialEvents,
  initialNextCursor,
}: {
  initialEvents: AuditTimelineEvent[];
  initialNextCursor: string | null;
}) {
  const [events, setEvents] = React.useState(initialEvents);
  const [nextCursor, setNextCursor] = React.useState(initialNextCursor);
  const [activeFilter, setActiveFilter] = React.useState<FilterId>("all");
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = React.useState<string | null>(null);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const visibleEvents = React.useMemo(() => {
    const filter = filters.find((item) => item.id === activeFilter) ?? filters[0];
    if (filter.id === "all") return events;
    return events.filter((event) => filter.resourceTypes.includes(event.resourceType));
  }, [activeFilter, events]);

  const loadMore = React.useCallback(async () => {
    if (!nextCursor || status === "loading") return;
    setStatus("loading");
    setMessage(null);

    const response = await fetch(`/api/audit?cursor=${encodeURIComponent(nextCursor)}`);
    const payload = (await response.json().catch(() => ({ error: "Activity could not be loaded." }))) as Partial<AuditResponse> & { error?: string };
    const nextEvents = payload.events;
    if (!response.ok || !Array.isArray(nextEvents)) {
      setStatus("error");
      setMessage(payload.error ?? "Activity could not be loaded.");
      return;
    }

    setEvents((current) => [...current, ...nextEvents]);
    setNextCursor(payload.nextCursor ?? null);
    setStatus("idle");
  }, [nextCursor, status]);

  React.useEffect(() => {
    if (!nextCursor || !sentinelRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "280px" });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore, nextCursor]);

  if (events.length === 0) {
    return (
      <Card className="mt-8 p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)]">
            <History className="size-4 text-[var(--muted)]" />
          </span>
          <div>
            <h2 className="font-serif text-[24px] leading-none">No activity yet.</h2>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[var(--muted)]">
              Uploads, reminders, exports, shares, and billing changes will appear here once they happen.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setActiveFilter(filter.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
              activeFilter === filter.id
                ? "border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {visibleEvents.length === 0 ? (
        <Card className="mt-5 p-5 text-[13px] text-[var(--muted)]">
          No events match this filter yet.
        </Card>
      ) : (
        <div className="mt-5 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
          {visibleEvents.map((event, index) => (
            <ActivityRow key={event.id} event={event} isLast={index === visibleEvents.length - 1} />
          ))}
        </div>
      )}

      {message && (
        <p className="mt-4 rounded-[var(--radius-sm)] border border-[color-mix(in_oklch,var(--color-coral)_28%,var(--border))] bg-[var(--color-coral-soft)] px-3 py-2 text-[12.5px] text-[var(--color-coral-ink)]">
          {message}
        </p>
      )}

      <div ref={sentinelRef} className="mt-5 flex justify-center">
        {nextCursor && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadMore()}
            disabled={status === "loading"}
          >
            {status === "loading" && <Loader2 className="size-3.5 animate-spin" />}
            {status === "loading" ? "Loading..." : "Load older activity"}
          </Button>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ event, isLast }: { event: AuditTimelineEvent; isLast: boolean }) {
  const Icon = iconForEvent(event);
  const href = hrefForEvent(event);
  const label = actionLabels[event.action] ?? event.action;

  return (
    <div className={cn("flex gap-3 p-4 sm:p-5", !isLast && "border-b border-[var(--border)]")}>
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)]">
        <Icon className="size-4 text-[var(--accent)]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium">{label}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--muted)]">
              <Badge tone="neutral" className="px-1.5 py-px text-[10px]">
                {resourceLabel(event.resourceType)}
              </Badge>
              {href ? (
                <Link href={href} className="truncate text-[var(--accent-ink)] underline-offset-2 hover:underline">
                  View resource
                </Link>
              ) : (
                <span>{event.resourceId ? `ID ${event.resourceId.slice(0, 8)}` : "No linked resource"}</span>
              )}
            </div>
          </div>
          <time className="shrink-0 font-mono text-[11px] text-[var(--faint)]" dateTime={event.createdAt}>
            {relativeTime(event.createdAt)}
          </time>
        </div>
      </div>
    </div>
  );
}

function iconForEvent(event: AuditTimelineEvent) {
  if (event.resourceType === "reminder") return BellRing;
  if (event.resourceType === "subscription") return CreditCard;
  if (event.resourceType === "document_share") return Share2;
  if (event.resourceType === "qa_conversation") return MessageSquareText;
  if (event.resourceType === "account") return ShieldCheck;
  return FileText;
}

function hrefForEvent(event: AuditTimelineEvent) {
  if (event.resourceType === "document" && event.resourceId) return `/dashboard/documents/${event.resourceId}`;
  if (event.resourceType === "document_export" && event.resourceId) return `/dashboard/documents/${event.resourceId}`;
  if (event.resourceType === "document_share") {
    const documentId = metadataString(event.metadata, "documentId");
    return documentId ? `/dashboard/documents/${documentId}` : null;
  }
  if (event.resourceType === "reminder") return "/dashboard/reminders";
  if (event.resourceType === "subscription") return "/dashboard/settings#billing";
  return null;
}

function resourceLabel(resourceType: string) {
  return resourceType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function metadataString(metadata: Json, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata[key as keyof typeof metadata];
  return typeof value === "string" ? value : null;
}

function relativeTime(value: string) {
  const deltaMs = new Date(value).getTime() - Date.now();
  const absMs = Math.abs(deltaMs);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of units) {
    if (absMs >= size) return formatter.format(Math.round(deltaMs / size), unit);
  }
  return "just now";
}
