import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadModal } from "../upload-modal";

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

describe("UploadModal", () => {
  beforeEach(() => {
    router.push.mockClear();
    router.refresh.mockClear();
    toast.error.mockClear();
    toast.success.mockClear();
    vi.stubGlobal("fetch", vi.fn());
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      plan: "free",
      usage: { documents: { current: 1, limit: 5 } },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lets a user paste contract text as an upload source", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ id: "doc-text" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }));

    render(<UploadModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /paste text/i }));
    fireEvent.change(screen.getByLabelText(/document name/i), { target: { value: "Website terms" } });
    fireEvent.change(screen.getByLabelText(/contract text/i), {
      target: { value: "Service terms with renewal, payment, cancellation, liability, notice, and privacy language. ".repeat(3) },
    });
    fireEvent.click(screen.getByRole("button", { name: /analyze pasted text/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/upload",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) })
    ));
    const body = vi.mocked(fetch).mock.calls[1][1]?.body as FormData;
    expect(body.get("source")).toBe("text");
    expect(body.get("title")).toBe("Website terms");
    expect(String(body.get("text"))).toContain("Service terms with renewal");
    expect(await screen.findByText(/pasted contract text/i)).toBeInTheDocument();
  });
});
