import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompareWithButton } from "../compare-with-button";
import type { ContractDoc } from "@/lib/mock-data";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function makeDoc(overrides: Partial<ContractDoc> & { id: string; title: string }): ContractDoc {
  return {
    party: "Greenfield LLC",
    type: "Lease",
    jurisdiction: "CA",
    pages: 4,
    effective: "2026-01-01",
    ends: "2027-01-01",
    risk: "Low",
    uploadedDaysAgo: 1,
    summary: "A contract.",
    tags: [],
    status: "ready",
    ...overrides,
  };
}

const currentDocument = makeDoc({ id: "doc-a", title: "Lease A" });
const otherDocument = makeDoc({ id: "doc-b", title: "Lease B" });

describe("CompareWithButton", () => {
  afterEach(() => {
    cleanup();
    push.mockClear();
  });

  it("opens the picker dialog and closes it on Escape", () => {
    render(<CompareWithButton currentDocument={currentDocument} documents={[currentDocument, otherDocument]} />);

    fireEvent.click(screen.getByRole("button", { name: /compare with another document/i }));
    expect(screen.getByRole("dialog", { name: /compare with another contract/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
