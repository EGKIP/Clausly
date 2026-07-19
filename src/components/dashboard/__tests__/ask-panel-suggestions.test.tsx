import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AskPanel } from "../document-view";

type FetchResponse = {
  ok: boolean;
  status?: number;
  body?: unknown;
};

const fetchMock = vi.fn();

function respond(response: FetchResponse) {
  return Promise.resolve({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: async () => response.body ?? {},
  });
}

function routeFetch(routes: Record<string, FetchResponse>) {
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    for (const [fragment, response] of Object.entries(routes)) {
      if (url.includes(fragment)) return respond(response);
    }
    return respond({ ok: false, status: 404 });
  });
}

describe("AskPanel suggested questions", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders suggestion chips when suggestions are available", async () => {
    routeFetch({
      "/suggested-questions": {
        ok: true,
        body: { suggestions: ["What's the termination clause?", "When does this auto-renew?"], pending: false },
      },
      "/api/ask/usage": { ok: false },
      "/api/conversations": { ok: true, body: { conversations: [] } },
    });

    render(<AskPanel docId="doc-1" docTitle="Lease" />);

    expect(await screen.findByText("What's the termination clause?")).toBeInTheDocument();
    expect(screen.getByText("Suggested questions")).toBeInTheDocument();
  });

  it("shows a loading skeleton while suggestions are being generated", async () => {
    routeFetch({
      "/suggested-questions": { ok: true, body: { suggestions: [], pending: true } },
      "/api/ask/usage": { ok: false },
      "/api/conversations": { ok: true, body: { conversations: [] } },
    });

    render(<AskPanel docId="doc-1" docTitle="Lease" />);

    expect(await screen.findByLabelText("Loading suggested questions")).toBeInTheDocument();
  });

  it("hides the section entirely when suggestions cannot be loaded", async () => {
    routeFetch({
      "/suggested-questions": { ok: false },
      "/api/ask/usage": { ok: false },
      "/api/conversations": { ok: true, body: { conversations: [] } },
    });

    render(<AskPanel docId="doc-1" docTitle="Lease" />);

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/suggested-questions"))).toBe(true);
    });
    expect(screen.queryByText("Suggested questions")).not.toBeInTheDocument();
  });

  it("submits the question when a suggestion chip is clicked", async () => {
    routeFetch({
      "/suggested-questions": {
        ok: true,
        body: { suggestions: ["What's the termination clause?"], pending: false },
      },
      "/api/ask/usage": { ok: false },
      "/api/conversations": { ok: true, body: { conversations: [] } },
      "/ask": { ok: false, status: 500, body: { error: "unavailable" } },
    });

    render(<AskPanel docId="doc-1" docTitle="Lease" />);

    fireEvent.click(await screen.findByText("What's the termination clause?"));

    await waitFor(() => {
      const askCall = fetchMock.mock.calls.find(([input]) => String(input).includes("/api/documents/doc-1/ask"));
      expect(askCall).toBeTruthy();
      expect(JSON.parse((askCall?.[1] as RequestInit).body as string)).toMatchObject({
        question: "What's the termination clause?",
      });
    });
  });
});
