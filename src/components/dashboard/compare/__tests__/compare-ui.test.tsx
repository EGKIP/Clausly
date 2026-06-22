import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComparePicker } from "../compare-picker";
import { CompareView } from "../compare-view";
import type { CompareResponse } from "../types";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("compare UI", () => {
  beforeEach(() => {
    push.mockClear();
    vi.unstubAllGlobals();
  });

  it("renders picker documents and navigates to compare params", () => {
    render(
      <ComparePicker
        documents={[
          { id: "doc-a", title: "Lease v1", type: "Lease", party: "Greenfield" },
          { id: "doc-b", title: "Lease v2", type: "Lease", party: "Greenfield" },
        ]}
      />
    );

    expect(screen.getByText("Lease v1")).toBeInTheDocument();
    expect(screen.getAllByText("Lease v2").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /compare contracts/i }));

    expect(push).toHaveBeenCalledWith("/dashboard/compare?a=doc-a&b=doc-b");
  });

  it("swap toggles the compare query params", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => comparePayload,
    })));

    render(<CompareView aId="doc-a" bId="doc-b" />);

    await waitFor(() => expect(screen.getByText("Lease v1")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /swap/i }));

    expect(push).toHaveBeenCalledWith("/dashboard/compare?a=doc-b&b=doc-a");
  });
});

const comparePayload: CompareResponse = {
  a: { id: "doc-a", title: "Lease v1", document_type: "lease" },
  b: { id: "doc-b", title: "Lease v2", document_type: "lease" },
  unmatchedA: [],
  unmatchedB: [],
  pairs: [
    {
      similarity: 0.92,
      aClause: {
        id: "a-clause",
        documentId: "doc-a",
        title: "Notice period",
        category: "Renewal",
        riskLevel: "medium",
        page: 4,
        sourceQuote: "Tenant must give 30 days notice.",
        plainEnglish: "Give 30 days notice.",
        whyItMatters: "Notice windows matter.",
        confidence: 0.9,
        bbox: null,
      },
      bClause: {
        id: "b-clause",
        documentId: "doc-b",
        title: "Notice period",
        category: "Renewal",
        riskLevel: "medium",
        page: 4,
        sourceQuote: "Tenant must give 60 days notice.",
        plainEnglish: "Give 60 days notice.",
        whyItMatters: "Notice windows matter.",
        confidence: 0.9,
        bbox: null,
      },
      diff: [
        { type: "equal", value: "Tenant must give " },
        { type: "remove", value: "30" },
        { type: "add", value: "60" },
        { type: "equal", value: " days notice." },
      ],
    },
  ],
};
