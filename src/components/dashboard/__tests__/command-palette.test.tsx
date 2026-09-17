import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "../command-palette";

describe("CommandPalette", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function mockDocumentsFetch() {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ documents: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
  }

  it("closes when Escape is pressed, matching the Esc hint it displays", async () => {
    mockDocumentsFetch();
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} />);

    await waitFor(() => expect(screen.getByText("Esc")).toBeInTheDocument());

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not respond to Escape while closed", () => {
    mockDocumentsFetch();
    const onClose = vi.fn();
    render(<CommandPalette open={false} onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("exposes dialog semantics for assistive tech", async () => {
    mockDocumentsFetch();
    render(<CommandPalette open onClose={() => {}} />);

    const dialog = await screen.findByRole("dialog", { name: /command palette/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("closes on a backdrop click but not on a click inside the panel", async () => {
    mockDocumentsFetch();
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} />);

    const dialog = await screen.findByRole("dialog", { name: /command palette/i });
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(dialog.parentElement as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
