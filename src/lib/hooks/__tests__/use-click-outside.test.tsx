import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { useClickOutside } from "../use-click-outside";

function TestPanel({ active, onDismiss }: { active: boolean; onDismiss: () => void }) {
  const ref = useClickOutside<HTMLDivElement>(active, onDismiss);
  return (
    <div>
      <div data-testid="panel" ref={ref}>
        <button type="button">Inside</button>
      </div>
      <button type="button" data-testid="outside">Outside</button>
    </div>
  );
}

function mousedown(element: Element) {
  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
}

describe("useClickOutside", () => {
  afterEach(() => cleanup());

  it("calls onDismiss when a mousedown lands outside the element", () => {
    const onDismiss = vi.fn();
    const { getByTestId } = render(<TestPanel active onDismiss={onDismiss} />);

    mousedown(getByTestId("outside"));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("does not call onDismiss for a mousedown inside the element", () => {
    const onDismiss = vi.fn();
    const { getByTestId } = render(<TestPanel active onDismiss={onDismiss} />);

    mousedown(getByTestId("panel"));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("does nothing when inactive", () => {
    const onDismiss = vi.fn();
    const { getByTestId } = render(<TestPanel active={false} onDismiss={onDismiss} />);

    mousedown(getByTestId("outside"));

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
