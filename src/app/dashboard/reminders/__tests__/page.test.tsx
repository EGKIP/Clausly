import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RemindersPage from "../page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("/dashboard/reminders", () => {
  it("shows the fetch error instead of also claiming the inbox is caught up", async () => {
    mockFetchByUrl((url) => {
      if (url.includes("/api/documents")) {
        return jsonResponse({ documents: [{ id: "doc-1", title: "Lease" }] });
      }
      if (url.includes("status=suggested")) {
        return jsonResponse({ error: "Server error" }, { status: 500 });
      }
      return jsonResponse({ reminders: [] });
    });

    render(<RemindersPage />);

    await waitFor(() => expect(screen.getByText("Server error")).toBeInTheDocument());

    expect(screen.queryByText(/Clausly's caught up/)).not.toBeInTheDocument();
  });
});

function mockFetchByUrl(handler: (url: string) => Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => handler(String(input)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}
