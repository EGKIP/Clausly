import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createServiceSupabaseClientMock,
  resetSupabaseMock,
  seedClause,
  seedDate,
  seedDocument,
  seedDocumentShare,
  seedReminder,
  userA,
} from "@/../tests/helpers/supabase";
import SharePage from "../page";

vi.mock("@/lib/notifications/supabase-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/notifications/supabase-service")>(
    "@/lib/notifications/supabase-service"
  );
  return {
    ...actual,
    createServiceSupabaseClient: () => createServiceSupabaseClientMock(),
  };
});
vi.mock("server-only", () => ({}));

describe("/share/[token] page", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  });

  it("renders a branded read-only digest", async () => {
    const document = seedDocument(userA, {
      title: "Public Digest Lease",
      party: "Greenfield LLC",
      summary: "A concise shared summary.",
    });
    seedDocumentShare(document.id, userA, { token: "page-token" });
    seedClause(document.id, userA, {
      title: "Termination",
      plain_english: "Either side can terminate with notice.",
      why_it_matters: "Notice timing matters.",
    });
    seedDate(document.id, userA, { label: "End date" });
    seedReminder(document.id, userA, { title: "Review before renewal" });

    render(await SharePage({ params: Promise.resolve({ token: "page-token" }) }));

    expect(screen.getByText("Clausly")).toBeInTheDocument();
    expect(screen.getByText("Read-only digest")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Public Digest Lease" })).toBeInTheDocument();
    expect(screen.getByText("A concise shared summary.")).toBeInTheDocument();
    expect(screen.getByText("Either side can terminate with notice.")).toBeInTheDocument();
    expect(screen.getByText(/Informational only/)).toBeInTheDocument();
  });
});
