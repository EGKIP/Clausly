"use client";

import * as React from "react";
import type { Reminder, ReminderDeliveryStatus, ReminderStatus } from "@/lib/mock-reminders";

export type ReminderFilters = {
  status?: ReminderStatus | "ignored" | "dismissed";
  documentId?: string;
};

export type ReminderMutationPatch = {
  title?: string;
  description?: string;
  fire_on?: string;
  reminder_time?: string | null;
};

type ReminderPayload = {
  reminder?: ApiReminder;
  reminders?: ApiReminder[];
  error?: string;
};

type ApiReminder = Reminder & {
  reminder_time?: string | null;
  delivery_status?: ReminderDeliveryStatus | null;
};

type State = {
  reminders: Reminder[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  approve: (id: string, overrides?: ReminderMutationPatch) => Promise<Reminder | null>;
  update: (id: string, patch: ReminderMutationPatch) => Promise<Reminder | null>;
  dismiss: (id: string) => Promise<boolean>;
  pendingIds: Set<string>;
};

export function useReminders(filters: ReminderFilters = {}): State {
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(() => new Set());

  const status = filters.status;
  const documentId = filters.documentId;

  const refetch = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const url = new URL("/api/reminders", window.location.origin);
    if (status) url.searchParams.set("status", status);
    if (documentId) url.searchParams.set("document_id", documentId);

    const response = await fetch(url);
    if (response.status === 503) {
      setReminders([]);
      setIsLoading(false);
      return;
    }

    if (!response.ok) {
      setReminders([]);
      setError(await responseError(response, "Unable to load reminders."));
      setIsLoading(false);
      return;
    }

    const payload = (await response.json()) as ReminderPayload;
    setReminders((payload.reminders ?? []).map(normalizeReminder));
    setIsLoading(false);
  }, [documentId, status]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const withPending = React.useCallback(async <T,>(id: string, action: () => Promise<T>) => {
    setPendingIds((current) => new Set(current).add(id));
    try {
      return await action();
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const approve = React.useCallback((id: string, overrides: ReminderMutationPatch = {}) => {
    const previous = reminders;
    setError(null);
    setReminders((current) => current.map((reminder) =>
      reminder.id === id ? applyPatchToReminder({ ...reminder, status: "approved" }, overrides) : reminder
    ));

    return withPending(id, async () => {
      const response = await fetch(`/api/reminders/${encodeURIComponent(id)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overrides),
      });

      if (!response.ok) {
        setReminders(previous);
        setError(await responseError(response, "Unable to approve reminder."));
        return null;
      }

      const payload = (await response.json()) as ReminderPayload;
      if (payload.reminder) {
        const nextReminder = normalizeReminder(payload.reminder);
        setReminders((current) => replaceReminder(current, nextReminder));
        return nextReminder;
      }
      return null;
    });
  }, [reminders, withPending]);

  const update = React.useCallback((id: string, patch: ReminderMutationPatch) => {
    setError(null);

    return withPending(id, async () => {
      const response = await fetch(`/api/reminders/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (!response.ok) {
        setError(await responseError(response, "Unable to update reminder."));
        return null;
      }

      const payload = (await response.json()) as ReminderPayload;
      if (payload.reminder) {
        const nextReminder = normalizeReminder(payload.reminder);
        setReminders((current) => replaceReminder(current, nextReminder));
        return nextReminder;
      }
      return null;
    });
  }, [withPending]);

  const dismiss = React.useCallback((id: string) => {
    const previous = reminders;
    setError(null);
    setReminders((current) => current.filter((reminder) => reminder.id !== id));

    return withPending(id, async () => {
      const response = await fetch(`/api/reminders/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) {
        setReminders(previous);
        setError(await responseError(response, "Unable to ignore reminder."));
        return false;
      }
      return true;
    });
  }, [reminders, withPending]);

  return { reminders, isLoading, error, refetch, approve, update, dismiss, pendingIds };
}

function replaceReminder(reminders: Reminder[], next: Reminder) {
  const exists = reminders.some((reminder) => reminder.id === next.id);
  if (!exists) return reminders;
  return reminders.map((reminder) => reminder.id === next.id ? next : reminder);
}

function applyPatchToReminder(reminder: Reminder, patch: ReminderMutationPatch) {
  return {
    ...reminder,
    title: patch.title ?? reminder.title,
    description: patch.description ?? reminder.description,
    fireOn: patch.fire_on ? formatDate(patch.fire_on) : reminder.fireOn,
    daysAway: patch.fire_on ? daysUntil(patch.fire_on) : reminder.daysAway,
    reminderTime: patch.reminder_time === undefined ? reminder.reminderTime : normalizeReminderTime(patch.reminder_time),
  };
}

function normalizeReminder(reminder: ApiReminder): Reminder {
  const reminderTime = normalizeReminderTime(reminder.reminderTime ?? reminder.reminder_time ?? null);
  const deliveryStatus = normalizeDeliveryStatus(reminder.deliveryStatus ?? reminder.delivery_status, reminder.status);
  return {
    ...reminder,
    reminderTime,
    deliveryStatus,
  };
}

function normalizeReminderTime(value: string | null | undefined) {
  if (!value) return null;
  return value.slice(0, 5);
}

function normalizeDeliveryStatus(value: unknown, status: ReminderStatus): ReminderDeliveryStatus | undefined {
  if (value === "delivered" || value === "bounced" || value === "complained" || value === "pending") return value;
  return status === "sent" ? "pending" : undefined;
}

async function responseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

function daysUntil(date: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(`${date}T00:00:00`);
  return Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}
