import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  resetSupabaseMock,
  seedDocument,
  seedReminder,
  userA,
} from "@/../tests/helpers/supabase";
import DashboardHomePage from "../page";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));
vi.mock("server-only", () => ({}));

describe("/dashboard", () => {
  beforeEach(() => resetSupabaseMock(userA));
  afterEach(() => cleanup());

  it("shows an empty state for upcoming attention when there are no pending reminders", async () => {
    seedDocument(userA, { id: "11111111-1111-4111-8111-111111111111" });

    render(await DashboardHomePage());

    expect(screen.getByText("Nothing needs attention right now. You're caught up.")).toBeInTheDocument();
  });

  it("lists pending reminders when they exist", async () => {
    const doc = seedDocument(userA, { id: "11111111-1111-4111-8111-111111111111" });
    seedReminder(doc.id, userA, { title: "Renew before deadline", status: "suggested" });

    render(await DashboardHomePage());

    expect(screen.queryByText("Nothing needs attention right now. You're caught up.")).not.toBeInTheDocument();
    expect(screen.getByText("Renew before deadline")).toBeInTheDocument();
  });

  it("does not list a still-analyzing document under Fresh summaries", async () => {
    seedDocument(userA, {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Still Processing Lease",
      status: "analyzing",
      risk_level: null,
    });

    render(await DashboardHomePage());

    const freshSummaries = screen.getByText("Fresh summaries").parentElement!.parentElement!;
    expect(within(freshSummaries).getByText("Nothing waiting. You're caught up.")).toBeInTheDocument();
    expect(within(freshSummaries).queryByText("Still Processing Lease")).not.toBeInTheDocument();
  });

  it("shows the Pro insight teaser's real monthly spend instead of hardcoded numbers", async () => {
    seedDocument(userA, {
      id: "11111111-1111-4111-8111-111111111111",
      monthly_value: 42,
      tags: [],
    });

    render(await DashboardHomePage());

    expect(screen.getByText("You're paying $42 / month across recurring contracts.")).toBeInTheDocument();
    expect(screen.queryByText(/\$2,054/)).not.toBeInTheDocument();
  });

  it("lists a ready document whose risk verdict is genuinely Needs Review", async () => {
    seedDocument(userA, {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Ambiguous Vendor Agreement",
      status: "ready",
      risk_level: "needs_review",
    });

    render(await DashboardHomePage());

    const freshSummaries = screen.getByText("Fresh summaries").parentElement!.parentElement!;
    expect(within(freshSummaries).getByText("Ambiguous Vendor Agreement")).toBeInTheDocument();
  });
});
