"use client";

import * as React from "react";
import type { Clause } from "@/lib/mock-clauses";
import type { ContractDoc } from "@/lib/mock-data";
import type { Reminder } from "@/lib/mock-reminders";
import type { DocumentStatus, KeyDate } from "@/lib/db/types";
import type { AnalysisFailureCategory } from "@/lib/ai/failure-categories";

type DocumentPayload = {
  document: ContractDoc;
  status: DocumentStatus;
  errorMessage: string | null;
  failureCategory: AnalysisFailureCategory | null;
  clauses: Clause[];
  dates: KeyDate[];
  reminders: Reminder[];
  signedUrl: string | null;
};

export function useDocument(id: string) {
  const [data, setData] = React.useState<DocumentPayload | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/documents/${id}`);
      if (cancelled) return;
      if (!response.ok) {
        setError("Unable to load document.");
        setIsLoading(false);
        return;
      }
      setData((await response.json()) as DocumentPayload);
      setIsLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { data, isLoading, error };
}

/* Polls /api/documents/[id] every `intervalMs` while `enabled` is true.
 * Stops polling automatically when the returned status leaves the set of
 * in-flight states. Designed for the analyzing → ready/failed transition on
 * the document detail page. */
export function useDocumentStatusPoll(
  id: string,
  initialStatus: DocumentStatus,
  options?: { intervalMs?: number; enabled?: boolean }
) {
  const interval = options?.intervalMs ?? 2500;
  const enabled = options?.enabled ?? true;
  const [status, setStatus] = React.useState<DocumentStatus>(initialStatus);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [failureCategory, setFailureCategory] = React.useState<AnalysisFailureCategory | null>(null);

  React.useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  React.useEffect(() => {
    if (!enabled) return;
    if (status !== "analyzing" && status !== "pending") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      try {
        const response = await fetch(`/api/documents/${id}`, { cache: "no-store" });
        if (cancelled) return;
        if (response.ok) {
          const payload = (await response.json()) as Pick<DocumentPayload, "status" | "errorMessage" | "failureCategory">;
          setStatus(payload.status);
          setErrorMessage(payload.errorMessage ?? null);
          setFailureCategory(payload.failureCategory ?? null);
          if (payload.status === "analyzing" || payload.status === "pending") {
            timer = setTimeout(tick, interval);
          }
          return;
        }
      } catch {
        /* swallow transient network errors; next tick will retry */
      }
      if (!cancelled) timer = setTimeout(tick, interval);
    }

    timer = setTimeout(tick, interval);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, id, interval, status]);

  return { status, errorMessage, failureCategory };
}
