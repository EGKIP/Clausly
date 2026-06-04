"use client";

import * as React from "react";
import type { ContractDoc } from "@/lib/mock-data";

type State = {
  documents: ContractDoc[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

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

  return { documents, isLoading, error, refetch };
}
