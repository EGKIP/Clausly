import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RenameableTitle } from "../rename-title";
import { DOCUMENTS_CHANGED_EVENT } from "@/lib/hooks/use-documents";

const router = vi.hoisted(() => ({
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

describe("RenameableTitle", () => {
  beforeEach(() => {
    router.refresh.mockClear();
    toast.error.mockClear();
    toast.success.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renames the document and notifies other mounted document lists", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const handleChange = vi.fn();
    window.addEventListener(DOCUMENTS_CHANGED_EVENT, handleChange);

    render(<RenameableTitle documentId="doc-1" title="Apartment lease" />);

    fireEvent.click(screen.getByRole("button", { name: /rename document/i }));
    const input = screen.getByRole("textbox", { name: /document name/i });
    fireEvent.change(input, { target: { value: "Updated lease title" } });
    fireEvent.click(screen.getByRole("button", { name: /save document name/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/documents/doc-1", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ title: "Updated lease title" }),
    })));
    expect(toast.success).toHaveBeenCalledWith("Document renamed.");
    expect(router.refresh).toHaveBeenCalled();
    expect(handleChange).toHaveBeenCalledOnce();

    window.removeEventListener(DOCUMENTS_CHANGED_EVENT, handleChange);
  });

  it("shows an error and does not notify listeners when the rename fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: "Document not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    }));
    const handleChange = vi.fn();
    window.addEventListener(DOCUMENTS_CHANGED_EVENT, handleChange);

    render(<RenameableTitle documentId="doc-1" title="Apartment lease" />);

    fireEvent.click(screen.getByRole("button", { name: /rename document/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /document name/i }), { target: { value: "New title" } });
    fireEvent.click(screen.getByRole("button", { name: /save document name/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Document not found."));
    expect(handleChange).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();

    window.removeEventListener(DOCUMENTS_CHANGED_EVENT, handleChange);
  });
});
