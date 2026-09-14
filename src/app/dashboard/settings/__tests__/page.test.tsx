import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "../page";

vi.mock("@/components/dashboard/settings/notification-preferences", () => ({
  NotificationPreferences: () => <div data-testid="notification-preferences" />,
}));
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const profileResponse = {
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  mockMode: false,
  notificationPreferences: { email: true, reminders: true, weeklyDigest: true },
  plan: "free",
  usage: { documents: { current: 1, limit: 5 } },
};

describe("SettingsPage delete-account dialog", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => profileResponse,
      }))
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  async function openDialog() {
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByText("ada@example.com")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
    const dialog = await screen.findByRole("dialog", { name: /delete account/i });
    return dialog;
  }

  it("opens with proper dialog semantics", async () => {
    const dialog = await openDialog();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("closes when Escape is pressed", async () => {
    await openDialog();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
