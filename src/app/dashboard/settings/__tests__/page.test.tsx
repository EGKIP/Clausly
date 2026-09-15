import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "../page";

vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const profile = {
  displayName: "Ada Lovelace",
  email: "ada@clausly.app",
  mockMode: false,
  notificationPreferences: { email: true },
  plan: "free" as const,
  usage: { documents: { current: 1, limit: 5 } },
};

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/settings/notifications")) {
        return new Response(JSON.stringify({ preferences: { email: true, reminders: true, weeklyDigest: true }, plan: "free" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(profile), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("closes the delete-account confirmation on Escape", async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByDisplayValue("Ada Lovelace")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
    expect(screen.getByRole("heading", { name: "Delete account" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("heading", { name: "Delete account" })).not.toBeInTheDocument();
  });

  it("closes the delete-account confirmation on backdrop click", async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByDisplayValue("Ada Lovelace")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
    const heading = screen.getByRole("heading", { name: "Delete account" });

    const backdrop = heading.closest("form")?.parentElement as HTMLElement;
    fireEvent.mouseDown(backdrop);

    expect(screen.queryByRole("heading", { name: "Delete account" })).not.toBeInTheDocument();
  });
});
