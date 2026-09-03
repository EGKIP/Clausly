"use client";

import * as React from "react";
import type { ContractDoc } from "@/lib/mock-data";

type State = {
  documents: ContractDoc[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

/** Fired after a document is created/deleted so every mounted useDocuments() picks it up. */
export const DOCUMENTS_CHANGED_EVENT = "clausly:documents-changed";

export function notifyDocumentsChanged() {
  window.dispatchEvent(new Event(DOCUMENTS_CHANGED_EVENT));
}

export function useDocuments(): State {
  const [documents, setDocuments] = React.useState<ContractDoc[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refetch = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const url = new URL("/api/documents", window.location.origin);
    if (new URLSearchParams(window.location.search).get("empty") === "1") {
      url.searchParams.set("empty", "1");
    }

    const response = await fetch(url);
    if (!response.ok) {
      setError("Unable to load documents.");
      setIsLoading(false);
      return;
    }
    const payload = (await response.json()) as { documents: ContractDoc[] };
    setDocuments(payload.documents);
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  React.useEffect(() => {
    const handleChange = () => void refetch();
    window.addEventListener(DOCUMENTS_CHANGED_EVENT, handleChange);
    return () => window.removeEventListener(DOCUMENTS_CHANGED_EVENT, handleChange);
  }, [refetch]);

  return { documents, isLoading, error, refetch };
}
