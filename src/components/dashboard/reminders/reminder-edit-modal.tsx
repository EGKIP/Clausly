"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Reminder } from "@/lib/mock-reminders";
import type { ReminderMutationPatch } from "@/lib/hooks/use-reminders";

type Props = {
  reminder: Reminder | null;
  isSaving: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (id: string, patch: ReminderMutationPatch) => Promise<Reminder | null>;
};

export function ReminderEditModal({ reminder, isSaving, error, onClose, onSave }: Props) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [fireOn, setFireOn] = React.useState("");
  const [reminderTime, setReminderTime] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!reminder) return;
    setTitle(reminder.title);
    setDescription(reminder.description);
    setFireOn(dateForInput(reminder.fireOn));
    setReminderTime("");
    setLocalError(null);
  }, [reminder]);

  if (!reminder) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    const currentReminder = reminder;
    if (!currentReminder) return;

    if (!title.trim()) {
      setLocalError("Add a title before saving.");
      return;
    }
    if (!fireOn) {
      setLocalError("Choose a reminder date.");
      return;
    }

    const saved = await onSave(currentReminder.id, {
      title: title.trim(),
      description: description.trim(),
      fire_on: fireOn,
      reminder_time: reminderTime || null,
    });

    if (saved) onClose();
  }

  const visibleError = localError ?? error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0%_0_0/0.45)] px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-edit-title"
        className="w-full max-w-[460px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 id="reminder-edit-title" className="text-[15px] font-medium">
              Edit reminder
            </h2>
            <p className="mt-1 text-[12.5px] text-[var(--muted)]">
              Adjust the timing before Clausly queues it.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--muted)]">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--ring)]"
              maxLength={120}
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-medium text-[var(--muted)]">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1.5 min-h-[92px] w-full resize-y rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--ring)]"
              maxLength={500}
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
            <label className="block">
              <span className="text-[12px] font-medium text-[var(--muted)]">Fire date</span>
              <input
                type="date"
                value={fireOn}
                onChange={(event) => setFireOn(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--ring)]"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-[var(--muted)]">Time</span>
              <input
                type="time"
                value={reminderTime}
                onChange={(event) => setReminderTime(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--ring)]"
              />
            </label>
          </div>

          {visibleError && (
            <div className="rounded-[var(--radius-sm)] border border-[color-mix(in_oklch,var(--color-coral)_35%,transparent)] bg-[var(--color-coral-soft)] px-3 py-2 text-[12.5px] text-[var(--color-coral-ink)]">
              {visibleError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function dateForInput(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}
