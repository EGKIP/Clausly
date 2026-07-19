import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthTrustPanel } from "../auth-trust-panel";

const LEAD_QUOTE = "The calm way to keep contracts, clauses, and reminders in one place.";

function stubMatchMedia(reduceMotion: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
    matches: reduceMotion,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
}

function activeQuote() {
  return document.querySelector('[aria-hidden="false"] blockquote')?.textContent ?? "";
}

describe("AuthTrustPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubMatchMedia(false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("auto-rotates to the next quote after the interval", () => {
    render(<AuthTrustPanel quote={LEAD_QUOTE} />);

    expect(activeQuote()).toContain("calm way");

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(activeQuote()).not.toContain("calm way");
  });

  it("pauses rotation while hovered", () => {
    const { container } = render(<AuthTrustPanel quote={LEAD_QUOTE} />);

    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);
    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    expect(activeQuote()).toContain("calm way");

    fireEvent.mouseLeave(container.firstElementChild as HTMLElement);
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(activeQuote()).not.toContain("calm way");
  });

  it("does not auto-rotate when reduced motion is preferred", () => {
    stubMatchMedia(true);
    render(<AuthTrustPanel quote={LEAD_QUOTE} />);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(activeQuote()).toContain("calm way");
  });

  it("jumps to a quote via its dot and keeps rotating from there", () => {
    render(<AuthTrustPanel quote={LEAD_QUOTE} />);

    fireEvent.click(screen.getByRole("tab", { name: "Grounded answers" }));
    expect(activeQuote()).toContain("citations");

    // A manual jump restarts the countdown: half an interval later the
    // selection must still be showing.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(activeQuote()).toContain("citations");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(activeQuote()).not.toContain("citations");
  });
});
