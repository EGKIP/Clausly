import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  resetSupabaseMock,
  seedDocument,
  seedReminder,
  seedUser,
  userA,
} from "@/../tests/helpers/supabase";
import InsightsPage from "../page";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));
vi.mock("server-only", () => ({}));

describe("/dashboard/insights", () => {
  beforeEach(() => resetSupabaseMock(userA));
  afterEach(() => cleanup());

  it("sums real per-document monthly values instead of showing a placeholder figure", async () => {
    seedUser(userA, { subscription_tier: "pro" });
    seedDocument(userA, { id: "doc-1", title: "Office lease", monthly_value: 1200 });
    seedDocument(userA, { id: "doc-2", title: "Software subscription", monthly_value: 350 });

    render(await InsightsPage());

    expect(screen.getByText("$1,550/mo")).toBeInTheDocument();
  });

  it("labels an overdue notice window as late instead of showing a negative day count", async () => {
    seedUser(userA, { subscription_tier: "pro" });
    const doc = seedDocument(userA, { id: "doc-1", title: "Office lease", monthly_value: 1200 });
    seedReminder(doc.id, userA, {
      title: "Send renewal opt-out notice",
      reminder_type: "Notice",
      status: "suggested",
      fire_on: "2020-01-01",
    });

    render(await InsightsPage());

    expect(screen.getByText(/days late/)).toBeInTheDocument();
    expect(screen.queryByText(/in -/)).not.toBeInTheDocument();
  });

  it("renders the upgrade teaser for free users instead of real spend data", async () => {
    seedUser(userA, { subscription_tier: "free" });
    seedDocument(userA, { id: "doc-1", monthly_value: 1200 });

    render(await InsightsPage());

    expect(screen.getByText("Pro insights")).toBeInTheDocument();
    expect(screen.queryByText(/\/mo/)).not.toBeInTheDocument();
  });
});
