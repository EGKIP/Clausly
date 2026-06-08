import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NotificationPreferencesCard,
  type NotificationPreferencesProfile,
} from "../notification-preferences-card";

const profile: NotificationPreferencesProfile = {
  displayName: "Ada",
  email: "ada@clausly.app",
  mockMode: false,
  notificationPreferences: { email: true, version: 2 },
};

describe("NotificationPreferencesCard", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the email toggle and disables save until local state changes", () => {
    render(<NotificationPreferencesCard profile={profile} onProfileSaved={vi.fn()} />);

    const toggle = screen.getByRole("switch", { name: /email notifications/i });
    const saveButton = screen.getByRole("button", { name: /save preferences/i });

    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(saveButton).toBeDisabled();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(saveButton).toBeEnabled();
  });

  it("calls PATCH with the updated email preference on save", async () => {
    const updatedProfile = {
      ...profile,
      notificationPreferences: { email: false, version: 3 },
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => updatedProfile,
    }));
    const onProfileSaved = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationPreferencesCard profile={profile} onProfileSaved={onProfileSaved} />);

    fireEvent.click(screen.getByRole("switch", { name: /email notifications/i }));
    fireEvent.click(screen.getByRole("button", { name: /save preferences/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_preferences: { email: false } }),
    });
    expect(onProfileSaved).toHaveBeenCalledWith(updatedProfile);
  });

  it("disables save in mock mode and shows the mock-mode hint", () => {
    render(
      <NotificationPreferencesCard
        profile={{ ...profile, mockMode: true }}
        onProfileSaved={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /save preferences/i })).toBeDisabled();
    expect(screen.getByText(/mock mode/i)).toBeInTheDocument();
  });
});
