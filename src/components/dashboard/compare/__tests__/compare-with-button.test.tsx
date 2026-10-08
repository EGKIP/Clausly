import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompareWithButton } from "../compare-with-button";
import type { ContractDoc } from "@/lib/mock-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const currentDocument = { id: "doc-1", title: "Current lease" } as ContractDoc;
const otherDocument = { id: "doc-2", title: "Other lease", party: "Acme", type: "Lease", jurisdiction: "MN" } as ContractDoc;

describe("CompareWithButton", () => {
  it("closes on Escape", () => {
    render(<CompareWithButton currentDocument={currentDocument} documents={[currentDocument, otherDocument]} />);

    fireEvent.click(screen.getByRole("button", { name: /compare with another document/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
