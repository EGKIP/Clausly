import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationPreferences } from "./notification-preferences";

const toast = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast }));

const proPayload = {
  preferences: { email: true, reminders: true, weeklyDigest: true },
  plan: "pro",
  mockMode: false,
};

describe("NotificationPreferences", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toast.error.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders loaded notification toggles", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(proPayload));

    render(<NotificationPreferences initialPlan="pro" />);

    expect(screen.getByText("Loading notification preferences...")).toBeInTheDocument();
    expect(await screen.findByRole("switch", { name: "All emails" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Reminder emails" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Weekly digest" })).toHaveAttribute("aria-checked", "true");
  });

  it("optimistically toggles and persists reminder emails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(proPayload))
      .mockResolvedValueOnce(jsonResponse({
        preferences: { email: true, reminders: false, weeklyDigest: true },
        plan: "pro",
        mockMode: false,
      }));

    render(<NotificationPreferences initialPlan="pro" />);
    const reminderSwitch = await screen.findByRole("switch", { name: "Reminder emails" });
    fireEvent.click(reminderSwitch);

    expect(reminderSwitch).toHaveAttribute("aria-checked", "false");
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith("/api/settings/notifications", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ reminders: false }),
    })));
  });

  it("rolls back optimistic updates on error", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(proPayload))
      .mockResolvedValueOnce(jsonResponse({ error: "Could not save." }, 500));

    render(<NotificationPreferences initialPlan="pro" />);
    const reminderSwitch = await screen.findByRole("switch", { name: "Reminder emails" });
    fireEvent.click(reminderSwitch);

    expect(reminderSwitch).toHaveAttribute("aria-checked", "false");
    await waitFor(() => expect(reminderSwitch).toHaveAttribute("aria-checked", "true"));
    expect(toast.error).toHaveBeenCalledWith("Could not save.");
  });

  it("renders the free-user weekly digest gate", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      preferences: { email: true, reminders: true, weeklyDigest: true },
      plan: "free",
      mockMode: false,
    }));

    render(<NotificationPreferences initialPlan="free" />);
    const weeklySwitch = await screen.findByRole("switch", { name: "Weekly digest" });

    expect(weeklySwitch).toBeDisabled();
    expect(weeklySwitch).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("link", { name: /upgrade to pro/i })).toHaveAttribute("href", "/dashboard/settings#billing");
  });

  it("greys and disables dependent toggles when the master switch is off", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(proPayload))
      .mockResolvedValueOnce(jsonResponse({
        preferences: { email: false, reminders: true, weeklyDigest: true },
        plan: "pro",
        mockMode: false,
      }));

    render(<NotificationPreferences initialPlan="pro" />);
    fireEvent.click(await screen.findByRole("switch", { name: "All emails" }));

    await waitFor(() => expect(screen.getByRole("switch", { name: "Reminder emails" })).toBeDisabled());
    expect(screen.getByRole("switch", { name: "Weekly digest" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Reminder emails" })).toHaveAttribute("aria-checked", "true");
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
