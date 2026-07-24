import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PastRemindersArchiveCard } from "../past-reminders-archive-card";

const dismiss = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/hooks/use-reminders", () => ({
  useReminders: () => ({
    reminders: remindersMock,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    approve: vi.fn(),
    update: vi.fn(),
    dismiss,
    pendingIds: new Set<string>(),
  }),
}));

let remindersMock: Array<{
  id: string;
  title: string;
  docId: string;
  docTitle: string;
  daysAway: number;
}>;

describe("PastRemindersArchiveCard", () => {
  beforeEach(() => {
    dismiss.mockReset();
    toast.error.mockClear();
    toast.success.mockClear();
    remindersMock = [
      { id: "past-1", title: "Loan due date", docId: "doc-1", docTitle: "Loan", daysAway: -8 },
      { id: "future-1", title: "Renewal date", docId: "doc-2", docTitle: "Lease", daysAway: 12 },
    ];
  });

  it("renders past suggested reminders and archives them", async () => {
    dismiss.mockResolvedValue(true);
    render(<PastRemindersArchiveCard />);

    expect(screen.getByText(/one suggested reminder is already past/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /loan due date/i })).toHaveAttribute("href", "/dashboard/documents/doc-1");

    fireEvent.click(screen.getByRole("button", { name: /archive all/i }));

    await waitFor(() => expect(dismiss).toHaveBeenCalledWith("past-1"));
    expect(dismiss).not.toHaveBeenCalledWith("future-1");
    expect(toast.success).toHaveBeenCalledWith("Past reminder archived.");
  });

  it("hides when there are no past reminders", () => {
    remindersMock = [{ id: "future-1", title: "Renewal date", docId: "doc-2", docTitle: "Lease", daysAway: 12 }];

    const { container } = render(<PastRemindersArchiveCard />);

    expect(container).toBeEmptyDOMElement();
  });
});
