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

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <ReminderEditModal
        reminder={reminder}
        isSaving={false}
        onClose={onClose}
        onSave={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not close on Escape while saving", () => {
    const onClose = vi.fn();
    render(
      <ReminderEditModal
        reminder={reminder}
        isSaving={true}
        onClose={onClose}
        onSave={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on backdrop click", () => {
    const onClose = vi.fn();
    render(
      <ReminderEditModal
        reminder={reminder}
        isSaving={false}
        onClose={onClose}
        onSave={vi.fn()}
      />
    );

    fireEvent.mouseDown(screen.getByRole("dialog").parentElement as Element);

    expect(onClose).toHaveBeenCalledOnce();
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

  it("shows the correct fire date for timezones ahead of UTC", () => {
    // The API formats fireOn as e.g. "Jan 5, 2026" in UTC (adapters.ts
    // formatDate). Re-parsing that string with `new Date()` interprets it in
    // the *local* timezone, which used to shift the date back a day for any
    // timezone ahead of UTC (e.g. Asia/Kolkata, UTC+5:30).
    const originalTz = process.env.TZ;
    process.env.TZ = "Asia/Kolkata";
    try {
      render(
        <ReminderEditModal
          reminder={{ ...reminder, fireOn: "Jan 5, 2026" }}
          isSaving={false}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      expect(screen.getByLabelText("Fire date")).toHaveValue("2026-01-05");
    } finally {
      process.env.TZ = originalTz;
    }
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
