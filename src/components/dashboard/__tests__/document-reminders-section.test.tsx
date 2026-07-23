import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentRemindersSection } from "../reminders/document-reminders-section";
import { useReminders, type ReminderMutationPatch } from "@/lib/hooks/use-reminders";
import type { ContractDoc } from "@/lib/mock-data";
import type { Reminder, ReminderStatus } from "@/lib/mock-reminders";

vi.mock("@/lib/hooks/use-reminders", () => ({
  useReminders: vi.fn(),
}));

const mockUseReminders = vi.mocked(useReminders);

type ReminderHookState = {
  reminders: Reminder[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  approve: (id: string, overrides?: ReminderMutationPatch) => Promise<Reminder | null>;
  update: (id: string, patch: ReminderMutationPatch) => Promise<Reminder | null>;
  dismiss: (id: string) => Promise<boolean>;
  pendingIds: Set<string>;
};

const doc: ContractDoc = {
  id: "doc-1",
  title: "Lease agreement",
  party: "Greenfield Holdings",
  type: "Lease",
  jurisdiction: "Minnesota",
  pages: 14,
  effective: "Sep 1, 2025",
  ends: "Aug 31, 2026",
  noticeBy: "Jul 1, 2026",
  risk: "Medium",
  uploadedDaysAgo: 3,
  summary: "A lease summary.",
  tags: ["Lease"],
  status: "ready",
};

const suggestedReminder = reminder({
  id: "suggested-1",
  title: "Lease non-renewal notice deadline",
  status: "suggested",
});

const approvedReminder = reminder({
  id: "approved-1",
  title: "Lease ends",
  status: "approved",
  daysAway: 59,
});

describe("DocumentRemindersSection", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders suggested and approved subsections for document reminders", () => {
    setupReminders({ suggested: [suggestedReminder], approved: [approvedReminder] });

    render(<DocumentRemindersSection doc={doc} />);

    expect(screen.getByRole("heading", { name: /Reminders .* 1 suggested .* 1 approved/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Suggested/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Approved/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Lease non-renewal notice deadline")).toBeInTheDocument();
    expect(screen.queryByText("Lease ends")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Approved/ }));

    expect(screen.getByText("Lease ends")).toBeInTheDocument();
  });

  it("hides when no suggested or approved reminders exist for the document", () => {
    setupReminders({
      suggested: [reminder({ id: "other-suggested", docId: "other-doc", status: "suggested" })],
      approved: [],
    });

    render(<DocumentRemindersSection doc={doc} />);

    expect(screen.queryByText("Reminders")).not.toBeInTheDocument();
  });

  it("hides when document status is not ready", () => {
    setupReminders({ suggested: [suggestedReminder], approved: [approvedReminder] });

    render(<DocumentRemindersSection doc={{ ...doc, status: "analyzing" }} />);

    expect(screen.queryByText("Reminders")).not.toBeInTheDocument();
  });

  it("hides when document status is missing", () => {
    setupReminders({ suggested: [suggestedReminder], approved: [approvedReminder] });

    const docWithoutStatus = { ...doc };
    delete (docWithoutStatus as Partial<ContractDoc>).status;
    render(<DocumentRemindersSection doc={docWithoutStatus as ContractDoc} />);

    expect(screen.queryByText("Reminders")).not.toBeInTheDocument();
  });

  it("disables Approve and explains why when the reminder date has passed", () => {
    const pastReminder = reminder({
      id: "past-1",
      title: "Missed notice deadline",
      status: "suggested",
      daysAway: -5,
    });
    setupReminders({ suggested: [pastReminder], approved: [] });

    render(<DocumentRemindersSection doc={doc} />);

    expect(screen.getByRole("button", { name: /^Approve$/ })).toBeDisabled();
    expect(
      screen.getByText("This date has already passed. Edit it to a future date to approve.")
    ).toBeInTheDocument();
  });

  it("keeps Approve enabled for future reminders", () => {
    setupReminders({ suggested: [suggestedReminder], approved: [] });

    render(<DocumentRemindersSection doc={doc} />);

    expect(screen.getByRole("button", { name: /^Approve$/ })).toBeEnabled();
  });

  it("calls reminder hook helpers from inline actions", async () => {
    const approve = vi.fn().mockResolvedValue({ ...suggestedReminder, status: "approved" });
    const update = vi.fn().mockResolvedValue({ ...suggestedReminder, title: "Updated deadline" });
    const dismiss = vi.fn().mockResolvedValue(true);
    setupReminders({
      suggested: [suggestedReminder],
      approved: [approvedReminder],
      suggestedOverrides: { approve, update, dismiss },
    });

    render(<DocumentRemindersSection doc={doc} />);

    fireEvent.click(screen.getAllByRole("button", { name: /^Approve$/ })[0]);
    await waitFor(() => expect(approve).toHaveBeenCalledWith("suggested-1"));

    fireEvent.click(screen.getAllByLabelText("Edit reminder")[0]);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Updated deadline" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith("suggested-1", expect.objectContaining({ title: "Updated deadline" }));
    });

    fireEvent.click(screen.getAllByLabelText("Ignore reminder")[0]);
    await waitFor(() => expect(dismiss).toHaveBeenCalledWith("suggested-1"));
  });
});

function setupReminders({
  suggested,
  approved,
  suggestedOverrides,
  approvedOverrides,
}: {
  suggested: Reminder[];
  approved: Reminder[];
  suggestedOverrides?: Partial<ReminderHookState>;
  approvedOverrides?: Partial<ReminderHookState>;
}) {
  const suggestedState = hookState(suggested, suggestedOverrides);
  const approvedState = hookState(approved, approvedOverrides);

  mockUseReminders.mockImplementation((filters = {}) => {
    if (filters.status === "approved") return approvedState;
    return suggestedState;
  });

  return { suggestedState, approvedState };
}

function hookState(reminders: Reminder[], overrides: Partial<ReminderHookState> = {}): ReminderHookState {
  return {
    reminders,
    isLoading: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(undefined),
    approve: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    dismiss: vi.fn().mockResolvedValue(false),
    pendingIds: new Set<string>(),
    ...overrides,
  };
}

function reminder(overrides: Partial<Reminder> & { status: ReminderStatus }): Reminder {
  return {
    id: "reminder-1",
    docId: "doc-1",
    docTitle: "Lease agreement",
    title: "Reminder title",
    description: "Reminder description.",
    fireOn: "Jul 1, 2026",
    daysAway: 27,
    channel: "Email",
    type: "Notice",
    ...overrides,
  };
}
