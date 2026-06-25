import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareDialog } from "./share-dialog";

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("sonner", () => ({ toast }));

describe("ShareDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toast.error.mockClear();
    toast.success.mockClear();
    vi.stubGlobal("fetch", vi.fn());
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(async () => undefined) },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows an upgrade card for free users", () => {
    render(<ShareDialog documentId="doc-1" plan="free" />);

    fireEvent.click(screen.getByRole("button", { name: /share document/i }));

    expect(screen.getByText("Share links are a Pro feature.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upgrade to pro/i })).toHaveAttribute("href", "/upgrade");
  });

  it("loads existing shares for Pro users", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      shares: [{
        id: "share-1",
        token: "token-1",
        expiresAt: null,
        revokedAt: null,
        viewCount: 3,
        createdAt: "2026-06-01T00:00:00.000Z",
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<ShareDialog documentId="doc-1" plan="pro" />);
    fireEvent.click(screen.getByRole("button", { name: /share document/i }));

    expect(await screen.findByText("token-1")).toBeInTheDocument();
    expect(screen.getByText("3 views")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/documents/doc-1/shares");
  });

  it("creates and copies a share link", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ shares: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "share-1",
        token: "token-1",
        url: "https://app.test/share/token-1",
        expiresAt: "2026-07-01T00:00:00.000Z",
      }), { status: 201, headers: { "Content-Type": "application/json" } }));

    render(<ShareDialog documentId="doc-1" plan="pro" />);
    fireEvent.click(screen.getByRole("button", { name: /share document/i }));
    await screen.findByText("No share links yet.");
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    expect(await screen.findByDisplayValue("https://app.test/share/token-1")).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith("/api/documents/doc-1/shares", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ expiresInDays: 7 }),
    }));

    fireEvent.click(screen.getByRole("button", { name: /copy share link/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://app.test/share/token-1"));
  });

  it("revokes an active share", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        shares: [{
          id: "share-1",
          token: "token-1",
          expiresAt: null,
          revokedAt: null,
          viewCount: 0,
          createdAt: "2026-06-01T00:00:00.000Z",
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));

    render(<ShareDialog documentId="doc-1" plan="pro" />);
    fireEvent.click(screen.getByRole("button", { name: /share document/i }));
    await screen.findByText("token-1");
    fireEvent.click(screen.getByRole("button", { name: /revoke/i }));

    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith("/api/documents/doc-1/shares/share-1", { method: "DELETE" }));
    expect(await screen.findByText("revoked")).toBeInTheDocument();
  });
});
