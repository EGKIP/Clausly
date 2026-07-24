"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, CalendarClock, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import { useReminders } from "@/lib/hooks/use-reminders";

export function PastRemindersArchiveCard() {
  const suggested = useReminders({ status: "suggested" });
  const [archiving, setArchiving] = React.useState(false);
  const pastReminders = suggested.reminders.filter((reminder) => reminder.daysAway < 0);

  if (suggested.isLoading || pastReminders.length === 0) return null;

  async function archivePastReminders() {
    setArchiving(true);
    const results = await Promise.all(pastReminders.map((reminder) => suggested.dismiss(reminder.id)));
    setArchiving(false);

    const failed = results.filter((ok) => !ok).length;
    if (failed > 0) {
      toast.error(failed === 1 ? "One past reminder could not be archived." : `${failed} past reminders could not be archived.`);
      return;
    }

    toast.success(pastReminders.length === 1 ? "Past reminder archived." : "Past reminders archived.");
  }

  return (
    <Card className="mt-8 border-[color-mix(in_oklch,var(--color-ember)_28%,var(--border))] bg-[var(--color-ember-soft)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Badge tone="ember">
            <TriangleAlert className="size-2.5" /> Attention needed
          </Badge>
          <h2 className="mt-3 text-[15px] font-medium">
            {pastReminders.length === 1
              ? "One suggested reminder is already past."
              : `${pastReminders.length} suggested reminders are already past.`}
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--muted)]">
            Archive expired suggestions you no longer need, or open Reminders to edit any date you still want to track.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pastReminders.slice(0, 3).map((reminder) => (
              <Link
                key={reminder.id}
                href={`/dashboard/documents/${reminder.docId}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11.5px] text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <CalendarClock className="size-3 shrink-0" />
                <span className="truncate">{reminder.title}</span>
              </Link>
            ))}
            {pastReminders.length > 3 && (
              <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11.5px] text-[var(--faint)]">
                +{pastReminders.length - 3} more
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
          <Button href="/dashboard/reminders" variant="secondary" size="sm" className="min-h-11 sm:min-h-0">
            Review dates
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={archiving || pastReminders.some((reminder) => suggested.pendingIds.has(reminder.id))}
            onClick={() => void archivePastReminders()}
            className="min-h-11 sm:min-h-0"
          >
            <Archive className="size-3.5" />
            {archiving ? "Archiving..." : "Archive all"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
