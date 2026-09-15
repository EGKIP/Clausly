import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthCard } from "../auth-card";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
    },
  }),
}));

function setLocation(href: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { origin: "https://clausly.test", href },
  });
}

describe("AuthCard", () => {
  beforeEach(() => {
    mocks.signInWithPassword.mockReset();
    mocks.signUp.mockReset();
    mocks.resetPasswordForEmail.mockReset();
    setLocation("https://clausly.test/login");
  });

  afterEach(() => {
    cleanup();
  });

  it("sanitizes an unsafe next path before redirecting after password sign-in", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    render(<AuthCard mode="login" next={"/\\evil.test" as string} />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@clausly.app" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mocks.signInWithPassword).toHaveBeenCalled());
    await waitFor(() => expect(window.location.href).toBe("/dashboard"));
  });

  it("redirects to a safe same-origin next path after password sign-in", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    render(<AuthCard mode="login" next="/dashboard/documents/123" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@clausly.app" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(window.location.href).toBe("/dashboard/documents/123"));
  });

  it("shows a check-your-inbox state instead of redirecting when signup requires email confirmation", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthCard mode="signup" next="/dashboard/welcome" />);

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@clausly.app" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Check your inbox.")).toBeInTheDocument();
    expect(window.location.href).toBe("https://clausly.test/login");
  });

  it("redirects straight to the dashboard when signup returns an active session", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    render(<AuthCard mode="signup" next="/dashboard/welcome" />);

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@clausly.app" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(window.location.href).toBe("/dashboard/welcome"));
  });

  it("sends the password reset link through the callback route so a reset-password page is reachable", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<AuthCard mode="forgot" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@clausly.app" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset email" }));

    await waitFor(() =>
      expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("user@clausly.app", {
        redirectTo: "https://clausly.test/auth/callback?next=%2Freset-password",
      })
    );
    expect(await screen.findByText("Check your inbox.")).toBeInTheDocument();
  });
});
