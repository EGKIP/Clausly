"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BellRing,
  Calendar,
  Check,
  Clock,
  Send,
  X,
  CalendarClock,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { useReminders, type ReminderMutationPatch } from "@/lib/hooks/use-reminders";
import { useDocuments } from "@/lib/hooks/use-documents";
import { PortfolioEmptyState } from "@/components/dashboard/empty-states/portfolio-empty";
import { ReminderEditModal } from "@/components/dashboard/reminders/reminder-edit-modal";
import { DeliveryBadge } from "@/components/dashboard/reminders/delivery-badge";
import type { Reminder } from "@/lib/mock-reminders";
import type { ReminderStatus } from "@/lib/mock-reminders";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const tabs: { id: ReminderStatus; label: string; description: string }[] = [
  { id: "suggested", label: "Suggested", description: "Clausly noticed these. Approve, edit, or ignore." },
  { id: "approved", label: "Approved", description: "Reminders you've okayed. They'll fire on schedule." },
  { id: "sent", label: "Sent", description: "Reminders Clausly has already delivered." },
];

const iconFor = (t: string) =>
  t === "Renewal" ? CalendarClock : t === "Notice" ? Calendar : t === "Review" ? Sparkles : ShieldAlert;

export default function RemindersPage() {
  const [tab, setTab] = React.useState<ReminderStatus>("suggested");
  const [editingReminder, setEditingReminder] = React.useState<Reminder | null>(null);
  const suggested = useReminders({ status: "suggested" });
  const approved = useReminders({ status: "approved" });
  const sent = useReminders({ status: "sent" });
  const { documents, isLoading: docsLoading } = useDocuments();
  const activeReminders = tab === "suggested" ? suggested : tab === "approved" ? approved : sent;
  const editingReminders = editingReminder?.status === "approved" ? approved : suggested;

  const handleApprove = React.useCallback(async (id: string) => {
    const saved = await suggested.approve(id);
    if (saved) {
      void approved.refetch();
      toast.success("Reminder approved.");
    } else {
      toast.error("Could not approve reminder.");
    }
  }, [approved, suggested]);

  const handleDismiss = React.useCallback(async (id: string) => {
    const ok = await suggested.dismiss(id);
    if (ok) toast.success("Reminder ignored.");
    else toast.error("Could not ignore reminder.");
  }, [suggested]);

  const handleSave = React.useCallback(async (id: string, patch: ReminderMutationPatch) => {
    const result = editingReminder?.status === "approved"
      ? await approved.update(id, patch)
      : await suggested.update(id, patch);
    if (result) toast.success("Reminder updated.");
    else toast.error("Could not update reminder.");
    return result;
  }, [approved, editingReminder?.status, suggested]);

  if (!docsLoading && documents.length === 0) {
    return (
      <PageBody>
        <PortfolioEmptyState variant="reminders" />
      </PageBody>
    );
  }

  const list = activeReminders.reminders;
  const counts: Record<ReminderStatus, number> = {
    suggested: suggested.reminders.length,
    approved: approved.reminders.length,
    sent: sent.reminders.length,
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow="Inbox"
        title="Reminders"
        description="Everything is suggested first. Clausly never fires a reminder without your nod."
        actions={
          <Button
            variant="secondary"
            size="md"
            className="min-h-11 w-full sm:w-auto"
            disabled
            title="Calendar view is coming soon."
          >
            <Calendar className="size-3.5" /> Calendar soon
          </Button>
        }
      />

      <div className="mt-8 flex max-w-full items-center gap-1 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-1 scrollbar-none sm:w-fit">
        {tabs.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] px-3.5 py-2 text-[13px] font-medium transition-colors sm:min-h-0",
                active ? "text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              {active && (
                <motion.span
                  layoutId="reminders-tab"
                  className="absolute inset-0 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative">{t.label}</span>
              <span
                className={cn(
                  "relative font-mono text-[10.5px] tabular-nums rounded-full px-1.5 py-px",
                  active
                    ? "bg-[var(--background)] text-[var(--muted)] border border-[var(--border)]"
                    : "bg-[var(--surface-2)] text-[var(--faint)]"
                )}
              >
                {counts[t.id]}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-[13px] text-[var(--muted)]">{tabs.find((t) => t.id === tab)?.description}</p>

      <div className="mt-6 space-y-2.5">
        {activeReminders.isLoading && <LoadingState />}
        {activeReminders.error && <InlineError message={activeReminders.error} />}
        {!activeReminders.isLoading && list.length === 0 && <EmptyState status={tab} />}
        {!activeReminders.isLoading && list.map((r, i) => {
          const Icon = iconFor(r.type);
          const urgent = r.daysAway > 0 && r.daysAway < 14;
          const isPending = activeReminders.pendingIds.has(r.id);
          return (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: Math.min(i, 8) * 0.04, ease: [0.165, 0.84, 0.44, 1] }}
              className="grid grid-cols-1 items-start gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div className="flex items-start gap-4 min-w-0">
                <span
                  className={cn(
                    "inline-flex size-11 items-center justify-center rounded-[var(--radius-sm)] border shrink-0",
                    tab === "sent"
                      ? "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]"
                      : urgent
                      ? "bg-[var(--color-coral-soft)] text-[var(--color-coral-ink)] border-[color-mix(in_oklch,var(--color-coral)_22%,transparent)]"
                      : "bg-[var(--color-ember-soft)] text-[var(--color-ember-ink)] border-[color-mix(in_oklch,var(--color-ember)_22%,transparent)]"
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="text-[14.5px] font-medium leading-tight">{r.title}</p>
                    <Badge tone="outline">{r.type}</Badge>
                  </div>
                  <p className="text-[12.5px] text-[var(--muted)] leading-relaxed">
                    {r.description}
                  </p>
                  <p className="mt-2 text-[11.5px] text-[var(--faint)]">
                    For{" "}
                    <Link href={`/dashboard/documents/${r.docId}`} className="text-[var(--accent-ink)] hover:underline">
                      {r.docTitle}
                    </Link>
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between md:justify-end">
                <div className="text-left sm:text-right">
                  {tab === "sent" ? (
                    <DeliveryBadge status={r.deliveryStatus ?? "pending"} />
                  ) : (
                    <>
                      <p className="font-serif text-[20px] leading-none tracking-[-0.01em] tabular-nums">
                        {Math.abs(r.daysAway)}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--faint)] mt-1">
                        {r.daysAway < 0 ? "days late" : "days away"}
                      </p>
                    </>
                  )}
                  <p className="font-mono text-[11px] text-[var(--muted)] mt-1 tabular-nums">{r.fireOn}</p>
                </div>
                {tab === "suggested" && (
                  <div data-tour="reminders" className="grid w-full grid-cols-1 gap-1.5 sm:w-auto sm:grid-cols-[auto_auto_auto]">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isPending}
                      onClick={() => void handleApprove(r.id)}
                      className="min-h-11 w-full sm:min-h-0 sm:w-auto"
                    >
                      <Check className="size-3.5" /> Approve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Edit timing"
                      disabled={isPending}
                      onClick={() => setEditingReminder(r)}
                      className="min-h-11 w-full sm:min-h-0 sm:w-auto"
                    >
                      <Clock className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Ignore"
                      disabled={isPending}
                      onClick={() => void handleDismiss(r.id)}
                      className="min-h-11 w-full sm:min-h-0 sm:w-auto"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                )}
                {tab === "approved" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setEditingReminder(r)}
                    className="min-h-11 w-full sm:min-h-0 sm:w-auto"
                  >
                    <Clock className="size-3.5" /> Edit
                  </Button>
                )}
                {tab === "sent" && (
                  <span className="inline-flex min-h-11 items-center gap-1.5 text-[12px] text-[var(--muted)] sm:min-h-0">
                    <Send className="size-3" />
                    Email · {r.channel.toLowerCase()}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      <ReminderEditModal
        reminder={editingReminder}
        isSaving={editingReminder ? editingReminders.pendingIds.has(editingReminder.id) : false}
        error={editingReminders.error}
        onClose={() => setEditingReminder(null)}
        onSave={handleSave}
      />
    </PageBody>
  );
}

function LoadingState() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-4"
        >
          <div className="flex items-start gap-4 min-w-0">
            <Skeleton variant="block" className="size-11 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Skeleton variant="pill" className="h-11 w-20 sm:h-8" />
            <Skeleton variant="pill" className="h-11 w-20 sm:h-8" />
          </div>
        </div>
      ))}
    </>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[color-mix(in_oklch,var(--color-coral)_28%,var(--border))] bg-[var(--color-coral-soft)] px-3 py-2 text-[12.5px] text-[var(--color-coral-ink)]">
      {message}
    </div>
  );
}

function EmptyState({ status, message }: { status: ReminderStatus; message?: string }) {
  const copy =
    message ??
    status === "suggested"
      ? "No suggestions right now — Clausly's caught up."
      : status === "approved"
      ? "No approved reminders yet. Approve a suggestion to queue one up."
      : "No reminders sent yet.";
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-12 text-center">
      <BellRing className="size-5 mx-auto text-[var(--faint)]" />
      <p className="mt-3 font-serif text-[18px]">{copy}</p>
    </div>
  );
}
