import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDismissOnEscape } from "../use-dismiss-on-escape";

function pressEscape() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
}

describe("useDismissOnEscape", () => {
  it("calls onDismiss when Escape is pressed while active", () => {
    const onDismiss = vi.fn();
    renderHook(() => useDismissOnEscape(true, onDismiss));

    pressEscape();

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("does nothing when inactive", () => {
    const onDismiss = vi.fn();
    renderHook(() => useDismissOnEscape(false, onDismiss));

    pressEscape();

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("ignores non-Escape keys", () => {
    const onDismiss = vi.fn();
    renderHook(() => useDismissOnEscape(true, onDismiss));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("stops listening once inactive", () => {
    const onDismiss = vi.fn();
    const { rerender } = renderHook(({ active }) => useDismissOnEscape(active, onDismiss), {
      initialProps: { active: true },
    });

    rerender({ active: false });
    pressEscape();

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
