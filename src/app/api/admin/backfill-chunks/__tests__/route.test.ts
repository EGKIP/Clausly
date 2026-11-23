import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createServiceSupabaseClientMock,
  db,
  failNext,
  resetSupabaseMock,
  seedDocument,
  seedStoredPdf,
  storageCalls,
  userA,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/notifications/supabase-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notifications/supabase-service")>();
  return { ...actual, createServiceSupabaseClient: () => createServiceSupabaseClientMock() };
});
vi.mock("@/lib/ai/pdf-text", () => ({
  extractPdfText: vi.fn(),
  extractPdfTextWithOcr: vi.fn(async () => "PDF lease text with a 60 day notice clause."),
}));

import { extractPdfTextWithOcr } from "@/lib/ai/pdf-text";
import { POST } from "../route";

const pdfExtractorMock = vi.mocked(extractPdfTextWithOcr);
const SECRET = "test-admin-secret";

function adminRequest() {
  return new Request("http://localhost.test/api/admin/backfill-chunks", {
    method: "POST",
    headers: { authorization: `Bearer ${SECRET}` },
  });
}

describe("/api/admin/backfill-chunks", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    process.env.CLAUSLY_ADMIN_SECRET = SECRET;
    pdfExtractorMock.mockClear();
  });

  afterEach(() => {
    delete process.env.CLAUSLY_ADMIN_SECRET;
  });

  it("rejects requests without the admin secret", async () => {
    const response = await POST(new Request("http://localhost.test/api/admin/backfill-chunks", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("indexes a pasted-text document with the text extractor, not the PDF one", async () => {
    const document = seedDocument(userA, { file_name: "contract.txt", mime_type: "text/plain" });
    const storedText = "Tenant must give 60 days written notice.";
    // jsdom's Blob lacks text(); match the Ask route test's stored-file stub.
    storageCalls().files.set(document.storage_path, {
      text: async () => storedText,
      type: "text/plain",
      size: storedText.length,
    } as Blob);

    const response = await POST(adminRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ processed: 1, failed: 0 });
    expect(pdfExtractorMock).not.toHaveBeenCalled();
    const chunks = db().document_chunks.filter((row) => row.document_id === document.id);
    expect(chunks.length).toBeGreaterThan(0);
    expect(String(chunks[0].content)).toContain("60 days written notice");
  });

  it("still uses the PDF extractor for PDFs", async () => {
    const document = seedDocument(userA);
    seedStoredPdf(document.storage_path);

    const response = await POST(adminRequest());

    await expect(response.json()).resolves.toEqual({ processed: 1, failed: 0 });
    expect(pdfExtractorMock).toHaveBeenCalledTimes(1);
  });

  it("counts a chunk-lookup error as one failure and keeps going", async () => {
    const first = seedDocument(userA);
    const second = seedDocument(userA);
    seedStoredPdf(first.storage_path);
    seedStoredPdf(second.storage_path);
    failNext("select", "document_chunks");

    const response = await POST(adminRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ processed: 1, failed: 1 });
  });

  it("counts a missing stored file as a failure", async () => {
    seedDocument(userA);

    const response = await POST(adminRequest());

    await expect(response.json()).resolves.toEqual({ processed: 0, failed: 1 });
  });
});
