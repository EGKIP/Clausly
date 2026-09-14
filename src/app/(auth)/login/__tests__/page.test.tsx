import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoginPage from "../page";

vi.mock("@/components/auth/auth-card", () => ({
  AuthCard: ({ next }: { next?: string }) => <div data-testid="next-value">{next}</div>,
}));
vi.mock("@/components/auth/auth-shell", () => ({
  AuthShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("/login page", () => {
  afterEach(() => {
    cleanup();
  });

  it("passes a same-origin next path through unchanged", async () => {
    render(
      await LoginPage({ searchParams: Promise.resolve({ next: "/dashboard/documents" }) })
    );

    expect(screen.getByTestId("next-value")).toHaveTextContent("/dashboard/documents");
  });

  it("falls back to /dashboard for a protocol-relative next URL", async () => {
    // "//evil.test" satisfies a naive startsWith("/") check but browsers
    // resolve it as "https://evil.test" — this must never reach AuthCard's
    // post-login redirect unsanitized.
    render(await LoginPage({ searchParams: Promise.resolve({ next: "//evil.test" }) }));

    expect(screen.getByTestId("next-value")).toHaveTextContent("/dashboard");
  });

  it("falls back to /dashboard for an absolute external next URL", async () => {
    render(
      await LoginPage({ searchParams: Promise.resolve({ next: "https://evil.test" }) })
    );

    expect(screen.getByTestId("next-value")).toHaveTextContent("/dashboard");
  });

  it("falls back to /dashboard when next is absent", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByTestId("next-value")).toHaveTextContent("/dashboard");
  });
});
