import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DOCUMENTS_CHANGED_EVENT, notifyDocumentsChanged, useDocuments } from "../use-documents";

describe("useDocuments", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("refetches when a documents-changed event fires, so an upload made elsewhere on the page shows up without a reload", async () => {
    const fetchMock = mockFetch(
      jsonResponse({ documents: [] }),
      jsonResponse({ documents: [{ id: "doc-1" }] })
    );

    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.documents).toEqual([]);

    act(() => {
      notifyDocumentsChanged();
    });

    await waitFor(() => expect(result.current.documents).toEqual([{ id: "doc-1" }]));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("exposes the same event name notifyDocumentsChanged dispatches", () => {
    const listener = vi.fn();
    window.addEventListener(DOCUMENTS_CHANGED_EVENT, listener);
    notifyDocumentsChanged();
    window.removeEventListener(DOCUMENTS_CHANGED_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

function mockFetch(...responses: Array<Response | Promise<Response>>) {
  const fetchMock = vi.fn<typeof fetch>();
  responses.forEach((response) => fetchMock.mockResolvedValueOnce(response as Response));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}
