"use client";

import * as React from "react";
import type { Clause } from "@/lib/mock-clauses";
import type { ContractDoc } from "@/lib/mock-data";
import type { Reminder } from "@/lib/mock-reminders";
import type { KeyDate } from "@/lib/db/types";

type DocumentPayload = {
  document: ContractDoc;
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
