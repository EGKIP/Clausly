import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatesPanel } from "../document-view";
import { daysUntil } from "@/lib/utils";
import type { ContractDoc } from "@/lib/mock-data";

const NOW = new Date("2026-09-28T12:00:00Z");

// Chosen so none of these coincide with the old hardcoded -90/27/86 values.
const doc: ContractDoc = {
  id: "doc-1",
  title: "Test Lease",
  party: "Test Party",
  type: "Lease",
  jurisdiction: "Minnesota",
  pages: 5,
  effective: "Sep 1, 2025",
  effectiveDate: "2025-09-01",
  ends: "Nov 15, 2026",
  endsDate: "2026-11-15",
  noticeBy: "Oct 15, 2026",
  noticeByDate: "2026-10-15",
  risk: "Low",
  uploadedDaysAgo: 5,
  summary: "A test lease.",
  tags: ["Lease"],
  status: "ready",
};

describe("DatesPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("computes each date's day count from the document's own dates instead of hardcoded placeholders", () => {
    render(<DatesPanel doc={doc} />);

    const effectiveDays = daysUntil(doc.effectiveDate!);
    const endsDays = daysUntil(doc.endsDate!);
    const noticeDays = daysUntil(doc.noticeByDate!);

    // Sanity check the fixture actually differs from the old hardcoded -90/27/86 days,
    // so this test would fail against the pre-fix hardcoded component.
    expect(effectiveDays).not.toBe(-90);
    expect(noticeDays).not.toBe(27);
    expect(endsDays).not.toBe(86);

    expect(screen.getByText(`${Math.abs(effectiveDays)}d ago`)).toBeInTheDocument();
    expect(screen.getByText(`${noticeDays}d`)).toBeInTheDocument();
    expect(screen.getByText(`${endsDays}d`)).toBeInTheDocument();
    expect(screen.queryByText("90d ago")).not.toBeInTheDocument();
    expect(screen.queryByText("27d")).not.toBeInTheDocument();
    expect(screen.queryByText("86d")).not.toBeInTheDocument();
  });

  it("shows a dash instead of a fabricated day count when a document has no end/notice date", () => {
    const docWithoutEnd: ContractDoc = {
      ...doc,
      ends: "—",
      endsDate: null,
      noticeBy: undefined,
      noticeByDate: undefined,
    };
    render(<DatesPanel doc={docWithoutEnd} />);

    expect(screen.queryByText("86d")).not.toBeInTheDocument();
    expect(screen.queryByText("27d")).not.toBeInTheDocument();
    expect(screen.getByText("Effective")).toBeInTheDocument();
    expect(screen.queryByText("Ends")).not.toBeInTheDocument();
    expect(screen.queryByText("Notice deadline")).not.toBeInTheDocument();
  });
});
