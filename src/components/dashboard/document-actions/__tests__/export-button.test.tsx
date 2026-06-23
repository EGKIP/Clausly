import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportButton } from "../export-button";
import type { ExportUsage } from "@/lib/exports/limits";

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("sonner", () => ({ toast }));

const usage: ExportUsage = {
  used: 3,
  limit: 5,
  remaining: 2,
  plan: "free",
  resetsAt: "2026-07-23T12:00:00.000Z",
};

describe("ExportButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toast.error.mockClear();
    toast.success.mockClear();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:export"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the export menu with free usage", () => {
    render(<ExportButton documentId="doc-1" usage={usage} />);

    fireEvent.click(screen.getByRole("button", { name: /export document/i }));

    expect(screen.getByRole("button", { name: /pdf digest/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /csv zip/i })).toBeInTheDocument();
    expect(screen.getByText("3 of 5 exports used this month.")).toBeInTheDocument();
  });

  it("fetches a PDF export and triggers a download", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(new Blob(["pdf"]), {
      status: 200,
      headers: { "Content-Disposition": 'attachment; filename="lease.pdf"' },
    }));
    const appendSpy = vi.spyOn(document.body, "append");

    render(<ExportButton documentId="doc-1" usage={usage} />);
    fireEvent.click(screen.getByRole("button", { name: /export document/i }));
    fireEvent.click(screen.getByRole("button", { name: /pdf digest/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/documents/doc-1/export?format=pdf"));
    expect(appendSpy).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Export ready.");
  });

  it("disables export when the limit is already reached", () => {
    render(<ExportButton documentId="doc-1" usage={{ ...usage, used: 5, remaining: 0 }} />);

    const button = screen.getByRole("button", { name: /export document/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Free plan export limit reached");
  });

  it("shows an upgrade affordance after a 429 response", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      error: "Free plan is limited to 5 exports every 30 days.",
      used: 5,
      limit: 5,
      plan: "free",
      resetsAt: "2026-07-23T12:00:00.000Z",
    }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    }));

    render(<ExportButton documentId="doc-1" usage={{ ...usage, used: 4, remaining: 1 }} />);
    fireEvent.click(screen.getByRole("button", { name: /export document/i }));
    fireEvent.click(screen.getByRole("button", { name: /csv zip/i }));

    expect(await screen.findByText(/Free plan is limited/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upgrade to pro/i })).toHaveAttribute("href", "/upgrade");
    expect(toast.error).toHaveBeenCalledWith("Free plan is limited to 5 exports every 30 days.");
  });
});
