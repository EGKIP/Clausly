import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  resetSupabaseMock,
  seedDocument,
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

  it("renders the upgrade teaser for free users instead of real spend data", async () => {
    seedUser(userA, { subscription_tier: "free" });
    seedDocument(userA, { id: "doc-1", monthly_value: 1200 });

    render(await InsightsPage());

    expect(screen.getByText("Pro insights")).toBeInTheDocument();
    expect(screen.queryByText(/\/mo/)).not.toBeInTheDocument();
  });
});
