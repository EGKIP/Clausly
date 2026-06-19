import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardShell } from "../shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { email: "ada@clausly.app" } } })),
    },
  }),
}));

vi.mock("@/lib/auth/actions", () => ({
  signOut: vi.fn(),
}));

describe("dashboard sidebar drawer", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ documents: [], reminders: [], usage: { documents: { current: 0, limit: 5 } } }),
    })));
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens on hamburger click", async () => {
    render(<DashboardShell><main>Dashboard</main></DashboardShell>);

    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));

    expect(await screen.findByRole("dialog", { name: /dashboard navigation/i })).toBeInTheDocument();
  });

  it("closes on overlay click", async () => {
    render(<DashboardShell><main>Dashboard</main></DashboardShell>);

    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));
    fireEvent.click(await screen.findByTestId("sidebar-overlay"));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /dashboard navigation/i })).not.toBeInTheDocument();
    });
  });

  it("closes on Escape key", async () => {
    render(<DashboardShell><main>Dashboard</main></DashboardShell>);

    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));
    expect(await screen.findByRole("dialog", { name: /dashboard navigation/i })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /dashboard navigation/i })).not.toBeInTheDocument();
    });
  });

  it("traps focus inside the drawer", async () => {
    render(<DashboardShell><main>Dashboard</main></DashboardShell>);

    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));
    const drawer = await screen.findByRole("dialog", { name: /dashboard navigation/i });
    const drawerQueries = within(drawer);
    const firstLink = drawerQueries.getByRole("link", { name: /clausly home/i });
    const lastLink = drawerQueries.getByRole("link", { name: /help/i });

    await waitFor(() => expect(firstLink).toHaveFocus());
    lastLink.focus();
    fireEvent.keyDown(drawer, { key: "Tab" });
    expect(firstLink).toHaveFocus();

    fireEvent.keyDown(drawer, { key: "Tab", shiftKey: true });
    expect(lastLink).toHaveFocus();
  });
});
