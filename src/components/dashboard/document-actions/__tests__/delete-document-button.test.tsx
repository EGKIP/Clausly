import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteDocumentButton } from "../delete-document-button";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("sonner", () => ({ toast }));

describe("DeleteDocumentButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    router.push.mockClear();
    router.refresh.mockClear();
    toast.error.mockClear();
    toast.success.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("asks for confirmation before deleting", () => {
    render(<DeleteDocumentButton documentId="doc-1" documentTitle="Apartment lease" />);

    fireEvent.click(screen.getByRole("button", { name: /delete document/i }));

    expect(screen.getByRole("dialog", { name: /delete this document/i })).toBeInTheDocument();
    expect(screen.getByText(/Apartment lease/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("deletes the document and redirects after confirmation", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    render(<DeleteDocumentButton documentId="doc-1" documentTitle="Apartment lease" />);
    fireEvent.click(screen.getByRole("button", { name: /delete document/i }));
    fireEvent.click(screen.getByRole("button", { name: /delete permanently/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/documents/doc-1", { method: "DELETE" }));
    expect(toast.success).toHaveBeenCalledWith("Document deleted.");
    expect(router.push).toHaveBeenCalledWith("/dashboard/documents");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("keeps the user on the document when deletion fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: "Document not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    }));

    render(<DeleteDocumentButton documentId="doc-1" documentTitle="Apartment lease" />);
    fireEvent.click(screen.getByRole("button", { name: /delete document/i }));
    fireEvent.click(screen.getByRole("button", { name: /delete permanently/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Document not found."));
    expect(router.push).not.toHaveBeenCalled();
  });
});
