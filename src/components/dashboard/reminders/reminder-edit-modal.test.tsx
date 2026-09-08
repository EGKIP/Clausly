import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReminderEditModal } from "./reminder-edit-modal";
import type { Reminder } from "@/lib/mock-reminders";

const futureFireOn = new Date(Date.now() + 23 * 86_400_000).toISOString().slice(0, 10);

const reminder: Reminder = {
  id: "reminder-1",
  docId: "document-1",
  docTitle: "Lease agreement",
  title: "Review renewal",
  description: "Check renewal language.",
  fireOn: futureFireOn,
  daysAway: 23,
  status: "approved",
  channel: "Email",
  type: "Renewal",
  reminderTime: "09:30",
};

describe("ReminderEditModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("pre-populates the saved reminder time", () => {
    render(
      <ReminderEditModal
        reminder={reminder}
        isSaving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Time")).toHaveValue("09:30");
  });

  it("closes without saving when values are unchanged", () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(
      <ReminderEditModal
        reminder={reminder}
        isSaving={false}
        onClose={onClose}
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("saves only changed timing fields", async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue({ ...reminder, reminderTime: "10:15" });
    render(
      <ReminderEditModal
        reminder={reminder}
        isSaving={false}
        onClose={onClose}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "10:15" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("reminder-1", { reminder_time: "10:15" });
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("blocks saving an approved reminder with a date moved into the past", async () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(
      <ReminderEditModal
        reminder={reminder}
        isSaving={false}
        onClose={onClose}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByLabelText("Fire date"), { target: { value: "2026-01-05" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/date that's already passed/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
