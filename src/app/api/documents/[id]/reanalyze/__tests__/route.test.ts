import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  resetSupabaseMock,
  routeContext,
  seedClause,
  seedDate,
  seedDocument,
  seedReminder,
  seedStoredPdf,
  setSupabaseUser,
  userA,
  userB,
} from "@/../tests/helpers/supabase";
import { extractPdfText } from "@/lib/ai/pdf-text";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));
vi.mock("@/lib/ai/pdf-text", () => ({ extractPdfText: vi.fn() }));

import { POST } from "../route";

const extractPdfTextMock = vi.mocked(extractPdfText);
const request = new Request("http://localhost.test/api/documents/doc/reanalyze", { method: "POST" });

describe("POST /api/documents/[id]/reanalyze", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    extractPdfTextMock.mockReset();
    extractPdfTextMock.mockResolvedValue(
      "Lease agreement tenant landlord rent $1800 effective 2026-09-01 end 2027-08-31 notice required."
    );
  });

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await POST(request, routeContext("missing"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when the document is not owned by the caller", async () => {
    const document = seedDocument(userB, { status: "failed" });

    const response = await POST(request, routeContext(document.id));

    expect(response.status).toBe(404);
  });

  it.each(["ready", "pending", "analyzing"])("returns 409 when status is %s", async (status) => {
    const document = seedDocument(userA, { status });

    const response = await POST(request, routeContext(document.id));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "Re-analysis is only available for failed documents." });
    expect(extractPdfTextMock).not.toHaveBeenCalled();
  });

  it("reanalyzes a failed document and replaces stale extracted rows", async () => {
    const document = seedDocument(userA, {
      status: "failed",
      title: "Greenfield Lease",
      file_name: "greenfield.pdf",
      jurisdiction: "Minnesota",
      error_message: "Previous failure",
      risk_level: null,
    });
    seedStoredPdf(document.storage_path, "pdf bytes");
    seedClause(document.id, userA, { title: "Stale clause" });
    seedDate(document.id, userA, { label: "Stale date" });
    seedReminder(document.id, userA, { title: "Stale reminder" });

    const response = await POST(request, routeContext(document.id));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, documentId: document.id });
    expect(body.clauseIds).toHaveLength(1);
    expect(body.dateIds).toHaveLength(1);
    expect(body.reminderIds).toHaveLength(1);
    expect(db().documents[0]).toMatchObject({
      id: document.id,
      status: "ready",
      error_message: null,
      risk_level: "medium",
      document_type: "lease",
    });
    expect(db().clauses).toEqual([
      expect.objectContaining({ title: "Notice window", document_id: document.id, user_id: userA.id }),
    ]);
    expect(db().dates).toEqual([
      expect.objectContaining({ label: "Lease end date", document_id: document.id, user_id: userA.id }),
    ]);
    expect(db().reminders).toEqual([
      expect.objectContaining({ title: "Send non-renewal notice", document_id: document.id, user_id: userA.id }),
    ]);
  });

  it("marks the document failed again when PDF extraction throws", async () => {
    const document = seedDocument(userA, { status: "failed", error_message: "Old failure" });
    seedStoredPdf(document.storage_path, "pdf bytes");
    extractPdfTextMock.mockRejectedValue(new Error("Still corrupt"));

    const response = await POST(request, routeContext(document.id));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Still corrupt");
    expect(db().documents[0]).toMatchObject({
      id: document.id,
      status: "failed",
      error_message: "Still corrupt",
    });
  });

  it("keeps tenant isolation for cross-tenant reanalysis attempts", async () => {
    const documentA = seedDocument(userA, { status: "failed" });
    const documentB = seedDocument(userB, { status: "failed" });
    seedStoredPdf(documentA.storage_path, "pdf A");
    seedStoredPdf(documentB.storage_path, "pdf B");

    setSupabaseUser(userB);
    const response = await POST(request, routeContext(documentA.id));

    expect(response.status).toBe(404);
    expect(db().documents.find((row) => row.id === documentA.id)?.status).toBe("failed");
    expect(db().documents.find((row) => row.id === documentB.id)?.status).toBe("failed");
    expect(extractPdfTextMock).not.toHaveBeenCalled();
  });
});
