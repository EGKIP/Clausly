import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import UnsubscribedPage from "../page";

async function renderPage(params: Record<string, string>) {
  render(await UnsubscribedPage({ searchParams: Promise.resolve(params) }));
}

describe("/unsubscribed", () => {
  // Unmount after each case so Link prefetch work does not run after jsdom teardown.
  afterEach(cleanup);

  it("confirms an email reminder unsubscribe and links to Settings", async () => {
    await renderPage({ status: "done" });

    expect(screen.getByRole("heading", { name: "You're unsubscribed" })).toBeInTheDocument();
    expect(screen.getByText(/no longer receive email reminders/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Settings" })).toHaveAttribute("href", "/dashboard/settings");
  });

  it("names the weekly digest when that list was unsubscribed", async () => {
    await renderPage({ status: "done", type: "weekly_digest" });

    expect(screen.getByText(/no longer receive weekly digest emails/)).toBeInTheDocument();
  });

  it("explains an invalid link", async () => {
    await renderPage({ status: "invalid" });

    expect(screen.getByRole("heading", { name: "This link is no longer valid" })).toBeInTheDocument();
  });

  it("falls back to the error message for unknown or missing status", async () => {
    await renderPage({});

    expect(screen.getByRole("heading", { name: "We couldn't update your preferences" })).toBeInTheDocument();
  });
});
