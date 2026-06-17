import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TourOverlay } from "./tour-overlay";

describe("TourOverlay", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })));
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the first step", () => {
    renderTour();

    expect(screen.getByRole("dialog", { name: "Start with a contract" })).toBeInTheDocument();
    expect(screen.getByText(/Drop a PDF you've signed/i)).toBeInTheDocument();
  });

  it("advances when Next is clicked", () => {
    renderTour();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("dialog", { name: "Watch Clausly read" })).toBeInTheDocument();
  });

  it("closes and persists when skipped", async () => {
    const fetchMock = vi.mocked(fetch);
    renderTour();

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/onboarding/tour", { method: "POST" }));
    expect(screen.queryByTestId("tour-overlay")).not.toBeInTheDocument();
  });

  it("fires completion on the final step", async () => {
    const fetchMock = vi.mocked(fetch);
    renderTour();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/onboarding/tour", { method: "POST" }));
    expect(screen.queryByTestId("tour-overlay")).not.toBeInTheDocument();
  });
});

function renderTour() {
  return render(
    <>
      <button data-tour="upload">Upload</button>
      <button data-tour="documents">Documents</button>
      <button data-tour="clauses">Clauses</button>
      <button data-tour="reminders">Reminders</button>
      <TourOverlay />
    </>
  );
}
