import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  resetSupabaseMock,
  routeContext,
  seedDocument,
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
const request = new Request("http://localhost.test/api/documents/doc/analyze", { method: "POST" });

describe("POST /api/documents/[id]/analyze", () => {
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
    const document = seedDocument(userB, { status: "pending" });

    const response = await POST(request, routeContext(document.id));

    expect(response.status).toBe(404);
  });

  it.each([
    ["analyzing", "Already analyzing."],
    ["ready", "Already analyzed. Delete and re-upload to re-run."],
  ])("returns 409 when status is %s", async (status, error) => {
    const document = seedDocument(userA, { status });

    const response = await POST(request, routeContext(document.id));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error });
    expect(extractPdfTextMock).not.toHaveBeenCalled();
  });

  it("analyzes an owned PDF and persists clauses, dates, reminders, and ready status", async () => {
    const document = seedDocument(userA, {
      status: "pending",
      title: "Greenfield Lease",
      file_name: "greenfield.pdf",
      jurisdiction: "Minnesota",
      risk_level: null,
    });
    const stored = seedStoredPdf(document.storage_path, "pdf bytes");

    const response = await POST(request, routeContext(document.id));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, documentId: document.id });
    expect(body.clauseIds).toHaveLength(1);
    expect(body.dateIds).toHaveLength(1);
    expect(body.reminderIds).toHaveLength(1);
    expect(extractPdfTextMock).toHaveBeenCalledWith(stored);
    expect(db().documents[0]).toMatchObject({
      id: document.id,
      user_id: userA.id,
      status: "ready",
      risk_level: "medium",
      error_message: null,
      document_type: "lease",
    });
    expect(db().clauses).toHaveLength(1);
    expect(db().dates).toHaveLength(1);
    expect(db().reminders).toHaveLength(1);
    expect(db().clauses.every((row) => row.user_id === userA.id)).toBe(true);
    expect(db().dates.every((row) => row.user_id === userA.id)).toBe(true);
    expect(db().reminders.every((row) => row.user_id === userA.id)).toBe(true);
  });

  it("marks the document failed when PDF extraction throws", async () => {
    const document = seedDocument(userA, { status: "pending", error_message: null });
    seedStoredPdf(document.storage_path, "pdf bytes");
    extractPdfTextMock.mockRejectedValue(new Error("Corrupt PDF fixture"));

    const response = await POST(request, routeContext(document.id));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Corrupt PDF fixture");
    expect(db().documents[0]).toMatchObject({
      id: document.id,
      status: "failed",
      error_message: "Corrupt PDF fixture",
    });
  });

  it("keeps tenant isolation for cross-tenant analyze attempts", async () => {
    const documentA = seedDocument(userA, { status: "pending" });
    const documentB = seedDocument(userB, { status: "pending" });
    seedStoredPdf(documentA.storage_path, "pdf A");
    seedStoredPdf(documentB.storage_path, "pdf B");

    setSupabaseUser(userB);
    const response = await POST(request, routeContext(documentA.id));

    expect(response.status).toBe(404);
    expect(db().documents.find((row) => row.id === documentA.id)?.status).toBe("pending");
    expect(db().documents.find((row) => row.id === documentB.id)?.status).toBe("pending");
    expect(extractPdfTextMock).not.toHaveBeenCalled();
  });
});
