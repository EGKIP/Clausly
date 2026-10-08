import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  resetSupabaseMock,
  seedAuditEvent,
  seedDocument,
  seedUser,
  userA,
} from "@/../tests/helpers/supabase";
import ActivityPage from "../page";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));
vi.mock("server-only", () => ({}));

describe("/dashboard/settings/activity", () => {
  beforeEach(() => resetSupabaseMock(userA));
  afterEach(() => cleanup());

  it("renders audit events for Pro users", async () => {
    seedUser(userA, { subscription_tier: "pro" });
    seedAuditEvent(userA, {
      action: "document.uploaded",
      resource_type: "document",
      resource_id: "11111111-1111-4111-8111-111111111111",
      created_at: "2026-06-02T00:00:00.000Z",
    });

    render(await ActivityPage());

    expect(screen.getByRole("heading", { name: "Activity log" })).toBeInTheDocument();
    expect(screen.getByText("Uploaded a document")).toBeInTheDocument();
  });

  it("does not link an export event to a document that was later deleted", async () => {
    seedUser(userA, { subscription_tier: "pro" });
    seedAuditEvent(userA, {
      action: "export.created",
      resource_type: "document_export",
      resource_id: "11111111-1111-4111-8111-111111111111",
      created_at: "2026-06-02T00:00:00.000Z",
    });

    render(await ActivityPage());

    expect(screen.getByText("Exported a document")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View resource" })).not.toBeInTheDocument();
  });

  it("still links an export event whose document still exists", async () => {
    seedUser(userA, { subscription_tier: "pro" });
    const document = seedDocument(userA);
    seedAuditEvent(userA, {
      action: "export.created",
      resource_type: "document_export",
      resource_id: document.id,
      created_at: "2026-06-02T00:00:00.000Z",
    });

    render(await ActivityPage());

    expect(screen.getByRole("link", { name: "View resource" })).toHaveAttribute(
      "href",
      `/dashboard/documents/${document.id}`
    );
  });

  it("renders the upgrade card for free users", async () => {
    seedUser(userA, { subscription_tier: "free" });

    render(await ActivityPage());

    expect(screen.getByText("Pro · Activity")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upgrade to pro/i })).toHaveAttribute("href", "/dashboard/settings#billing");
  });
});
