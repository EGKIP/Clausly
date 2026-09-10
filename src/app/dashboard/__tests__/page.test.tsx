import { cleanup, render, screen } from "@testing-library/react";
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
});
