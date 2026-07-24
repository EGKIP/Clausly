"use client";

import * as React from "react";
import { BellRing, Calendar, CalendarClock, Check, ChevronDown, Clock, ShieldAlert, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import type { ContractDoc } from "@/lib/mock-data";
import type { Reminder } from "@/lib/mock-reminders";
import { useReminders, type ReminderMutationPatch } from "@/lib/hooks/use-reminders";
import { cn } from "@/lib/utils";
import { ReminderEditModal } from "./reminder-edit-modal";

type ReminderWithDocumentAliases = Reminder & {
  document_id?: string;
  documentId?: string;
};

const iconFor = (type: Reminder["type"]) =>
  type === "Renewal" ? CalendarClock : type === "Notice" ? Calendar : type === "Review" ? Sparkles : ShieldAlert;

export function DocumentRemindersSection({ doc }: { doc: ContractDoc }) {
  if (doc.status !== "ready") return null;
  return <ReadyDocumentRemindersSection doc={doc} />;
}

function ReadyDocumentRemindersSection({ doc }: { doc: ContractDoc }) {
  const [suggestedOpen, setSuggestedOpen] = React.useState(true);
  const [approvedOpen, setApprovedOpen] = React.useState(false);
  const [editingReminder, setEditingReminder] = React.useState<Reminder | null>(null);
  const suggested = useReminders({ status: "suggested" });
  const approved = useReminders({ status: "approved" });

  const suggestedForDocument = suggested.reminders.filter((reminder) => reminderDocumentId(reminder) === doc.id);
  const approvedForDocument = approved.reminders.filter((reminder) => reminderDocumentId(reminder) === doc.id);
  const hasReminders = suggestedForDocument.length > 0 || approvedForDocument.length > 0;

  if (!hasReminders) return null;

  const editingReminders = editingReminder?.status === "approved" ? approved : suggested;

  async function handleApprove(id: string) {
    const saved = await suggested.approve(id);
    if (saved) void approved.refetch();
  }

  function handleSave(id: string, patch: ReminderMutationPatch) {
    return editingReminder?.status === "approved"
      ? approved.update(id, patch)
      : suggested.update(id, patch);
  }

  return (
    <section className="mb-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2 sm:items-center">
          <span className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-ember-soft)] text-[var(--color-ember-ink)]">
            <BellRing className="size-4" />
          </span>
          <h2 className="text-[14px] font-medium leading-snug">
            Reminders <span className="text-[var(--faint)]">·</span>{" "}
            <span className="tabular-nums">{suggestedForDocument.length}</span> suggested{" "}
            <span className="text-[var(--faint)]">·</span>{" "}
            <span className="tabular-nums">{approvedForDocument.length}</span> approved
          </h2>
        </div>
        <Badge tone="outline">{suggestedForDocument.length + approvedForDocument.length}</Badge>
      </div>

      <div className="mt-4 space-y-3">
        {suggestedForDocument.length > 0 && (
          <ReminderGroup
            title="Suggested"
            count={suggestedForDocument.length}
            isOpen={suggestedOpen}
            onToggle={() => setSuggestedOpen((open) => !open)}
          >
            {suggestedForDocument.map((reminder) => (
              <ReminderRow
                key={reminder.id}
                reminder={reminder}
                pending={suggested.pendingIds.has(reminder.id)}
                onApprove={() => void handleApprove(reminder.id)}
                onEdit={() => setEditingReminder(reminder)}
                onDismiss={() => void suggested.dismiss(reminder.id)}
              />
            ))}
          </ReminderGroup>
        )}

        {approvedForDocument.length > 0 && (
          <ReminderGroup
            title="Approved"
            count={approvedForDocument.length}
            isOpen={approvedOpen}
            onToggle={() => setApprovedOpen((open) => !open)}
          >
            {approvedForDocument.map((reminder) => (
              <ReminderRow
                key={reminder.id}
                reminder={reminder}
                pending={approved.pendingIds.has(reminder.id)}
                onEdit={() => setEditingReminder(reminder)}
              />
            ))}
          </ReminderGroup>
        )}
      </div>

      {(suggested.error || approved.error) && (
        <p className="mt-3 rounded-[var(--radius-sm)] border border-[color-mix(in_oklch,var(--color-coral)_28%,var(--border))] bg-[var(--color-coral-soft)] px-3 py-2 text-[12.5px] text-[var(--color-coral-ink)]">
          {suggested.error ?? approved.error}
        </p>
      )}

      <ReminderEditModal
        reminder={editingReminder}
        isSaving={editingReminder ? editingReminders.pendingIds.has(editingReminder.id) : false}
        error={editingReminders.error}
        onClose={() => setEditingReminder(null)}
        onSave={handleSave}
      />
    </section>
  );
}

function ReminderGroup({
  title,
  count,
  isOpen,
  onToggle,
  children,
}: {
  title: "Suggested" | "Approved";
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-[var(--surface-2)]"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span className="text-[12.5px] font-medium">
          {title} <span className="font-mono text-[10.5px] text-[var(--faint)] tabular-nums">({count})</span>
        </span>
        <ChevronDown
          className={cn("size-3.5 text-[var(--faint)] transition-transform", isOpen && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {isOpen && <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">{children}</div>}
    </div>
  );
}

function ReminderRow({
  reminder,
  pending,
  onApprove,
  onEdit,
  onDismiss,
}: {
  reminder: Reminder;
  pending: boolean;
  onApprove?: () => void;
  onEdit: () => void;
  onDismiss?: () => void;
}) {
  const Icon = iconFor(reminder.type);
  const urgent = reminder.daysAway > 0 && reminder.daysAway < 14;
  const isPast = reminder.daysAway < 0;

  return (
    <div className="grid grid-cols-1 gap-3 px-3.5 py-3 md:grid-cols-[1fr_auto] md:items-center">
      <div className="flex items-start gap-3 min-w-0">
        <span
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] border shrink-0",
            urgent
              ? "bg-[var(--color-coral-soft)] text-[var(--color-coral-ink)] border-[color-mix(in_oklch,var(--color-coral)_22%,transparent)]"
              : "bg-[var(--color-ember-soft)] text-[var(--color-ember-ink)] border-[color-mix(in_oklch,var(--color-ember)_22%,transparent)]"
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13.5px] font-medium leading-tight">{reminder.title}</p>
            <Badge tone="outline">{reminder.type}</Badge>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--muted)]">{reminder.description}</p>
          <p className="mt-2 font-mono text-[11px] text-[var(--faint)] tabular-nums">
            {reminder.fireOn} · {reminder.daysAway < 0 ? `${Math.abs(reminder.daysAway)} days late` : `${reminder.daysAway} days away`}
          </p>
          {isPast && onApprove && (
            <p className="mt-1 text-[11.5px] text-[var(--color-coral-ink)]">
              This date has already passed. Edit it to a future date to approve.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap md:justify-end">
        {onApprove && (
          <Button
            variant="primary"
            size="sm"
            disabled={pending || isPast}
            title={isPast ? "This date has passed. Edit the reminder to a future date first." : undefined}
            onClick={onApprove}
            className="min-h-11 w-full sm:min-h-0 sm:w-auto"
          >
            <Check className="size-3.5" /> Approve
          </Button>
        )}
        <Button
          variant={onApprove ? "ghost" : "secondary"}
          size="sm"
          disabled={pending}
          aria-label={onApprove ? "Edit reminder" : undefined}
          onClick={onEdit}
          className="min-h-11 w-full sm:min-h-0 sm:w-auto"
        >
          <Clock className="size-3.5" />
          {!onApprove && "Edit"}
        </Button>
        {onDismiss && (
          <Button variant="ghost" size="sm" disabled={pending} aria-label="Ignore reminder" onClick={onDismiss} className="min-h-11 w-full sm:min-h-0 sm:w-auto">
            <X className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function reminderDocumentId(reminder: ReminderWithDocumentAliases) {
  return reminder.docId ?? reminder.documentId ?? reminder.document_id;
}
