import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordCard } from "../reset-password-card";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: mocks.getSession,
      updateUser: mocks.updateUser,
    },
  }),
}));

function setLocation() {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { origin: "https://clausly.test", href: "https://clausly.test/reset-password" },
  });
}

describe("ResetPasswordCard", () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.updateUser.mockReset();
    setLocation();
  });

  afterEach(() => {
    cleanup();
  });

  it("prompts for a new reset link when the recovery link has no active session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    render(<ResetPasswordCard />);

    expect(await screen.findByText("Link expired.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send a new reset link" })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
  });

  it("rejects mismatched passwords without calling updateUser", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    render(<ResetPasswordCard />);

    await screen.findByText("Choose a new password.");
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "correct-horse-1" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different-horse-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));

    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("updates the password and returns to the dashboard on success", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mocks.updateUser.mockResolvedValue({ error: null });
    render(<ResetPasswordCard />);

    await screen.findByText("Choose a new password.");
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "correct-horse-1" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "correct-horse-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith({ password: "correct-horse-1" }));
    await waitFor(() => expect(window.location.href).toBe("/dashboard"));
  });

  it("shows the server error message when updateUser fails", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mocks.updateUser.mockResolvedValue({ error: new Error("Password is too weak.") });
    render(<ResetPasswordCard />);

    await screen.findByText("Choose a new password.");
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "correct-horse-1" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "correct-horse-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));

    expect(await screen.findByText("Password is too weak.")).toBeInTheDocument();
  });
});
