"use client";

import * as React from "react";
import type { Reminder } from "@/lib/mock-reminders";

export function useReminders() {
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refetch = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const response = await fetch("/api/reminders");
    if (!response.ok) {
      setError("Unable to load reminders.");
      setIsLoading(false);
      return;
    }
    const payload = (await response.json()) as { reminders: Reminder[] };
    setReminders(payload.reminders);
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  return { reminders, isLoading, error, refetch };
}
