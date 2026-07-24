import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  resetSupabaseMock,
  seedDocument,
  seedStoredPdf,
  storageCalls,
  userA,
} from "@/../tests/helpers/supabase";
import type { AnalysisResult } from "../schema";

vi.mock("@/lib/ai/pdf-text", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../pdf-text")>();
  return { extractPdfText: vi.fn(), NoTextLayerError: actual.NoTextLayerError };
});
vi.mock("@/lib/ai/provider", () => ({
  analyzeDocument: vi.fn(),
  getAnalysisProvider: () => "mock",
  getAnalysisModel: () => "mock",
}));

import { extractPdfText } from "@/lib/ai/pdf-text";
import { analyzeDocument } from "@/lib/ai/provider";
import {
  AlreadyAnalyzingError,
  claimAnalysisAttempt,
  markAnalysisFailed,
  runAnalysis,
} from "../run-analysis";

const extractPdfTextMock = vi.mocked(extractPdfText);
const analyzeDocumentMock = vi.mocked(analyzeDocument);

function analysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    documentTitle: "Analyzed lease",
    documentType: "lease",
    jurisdiction: "Minnesota",
    summaryShort: "Summary.",
    summaryLong: "Longer summary.",
    riskLevel: "Medium",
    riskReasons: ["Reason"],
    pageCount: 3,
    monthlyValue: 1800,
    effectiveDate: "2026-09-01",
    endDate: "2027-08-31",
    noticeWindowDays: 60,
    tags: ["Lease"],
    clauses: [],
    importantDates: [],
    suggestedReminders: [],
    ...overrides,
  };
}

describe("claimAnalysisAttempt", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    extractPdfTextMock.mockReset();
    analyzeDocumentMock.mockReset();
  });

  it("increments analysis_attempts and flips status to analyzing", async () => {
    const document = seedDocument(userA, { status: "pending", analysis_attempts: 0, analysis_started_at: null });
    const client = createSupabaseClient() as never;

    const claim = await claimAnalysisAttempt(client, document.id, userA.id);

    expect(claim).toMatchObject({ claimed: true, attemptToken: 1 });
    expect(db().documents[0]).toMatchObject({ status: "analyzing", analysis_attempts: 1 });
    expect(db().documents[0].analysis_started_at).not.toBeNull();
  });

  it("does not claim a document that is already analyzing", async () => {
    const document = seedDocument(userA, {
      status: "analyzing",
      analysis_attempts: 1,
      analysis_started_at: "2026-06-01T00:00:00.000Z",
    });
    const client = createSupabaseClient() as never;

    const claim = await claimAnalysisAttempt(client, document.id, userA.id);

    expect(claim).toEqual({ claimed: false });
    expect(db().documents[0]).toMatchObject({ status: "analyzing", analysis_attempts: 1 });
  });

  it("reclaims a stale analyzing document when requireStaleSince matches", async () => {
    const document = seedDocument(userA, {
      status: "analyzing",
      analysis_attempts: 1,
      analysis_started_at: "2026-06-01T00:00:00.000Z",
    });
    const client = createSupabaseClient() as never;

    const claim = await claimAnalysisAttempt(client, document.id, userA.id, {
      requireStaleSince: "2026-06-01T00:10:00.000Z",
    });

    expect(claim).toMatchObject({ claimed: true, attemptToken: 2 });
    expect(db().documents[0]).toMatchObject({ status: "analyzing", analysis_attempts: 2 });
  });

  it("does not reclaim an analyzing document that isn't stale yet", async () => {
    const document = seedDocument(userA, {
      status: "analyzing",
      analysis_attempts: 1,
      analysis_started_at: "2026-06-01T00:20:00.000Z",
    });
    const client = createSupabaseClient() as never;

    const claim = await claimAnalysisAttempt(client, document.id, userA.id, {
      requireStaleSince: "2026-06-01T00:10:00.000Z",
    });

    expect(claim).toEqual({ claimed: false });
    expect(db().documents[0]).toMatchObject({ status: "analyzing", analysis_attempts: 1 });
  });
});

describe("runAnalysis", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    extractPdfTextMock.mockReset();
    analyzeDocumentMock.mockReset();
  });

  it("throws AlreadyAnalyzingError without touching extraction when already analyzing", async () => {
    const document = seedDocument(userA, { status: "analyzing", analysis_attempts: 1 });
    seedStoredPdf(document.storage_path);
    const client = createSupabaseClient() as never;

    await expect(runAnalysis(client, document.id, userA.id)).rejects.toBeInstanceOf(AlreadyAnalyzingError);
    expect(extractPdfTextMock).not.toHaveBeenCalled();
  });

  it("persists a successful run and leaves the document ready", async () => {
    const document = seedDocument(userA, { status: "pending", analysis_attempts: 0 });
    seedStoredPdf(document.storage_path);
    extractPdfTextMock.mockResolvedValue("Lease text with enough content.");
    analyzeDocumentMock.mockResolvedValue(analysisResult());
    const client = createSupabaseClient() as never;

    const result = await runAnalysis(client, document.id, userA.id);

    expect(result.documentId).toBe(document.id);
    expect(db().documents[0]).toMatchObject({
      status: "ready",
      analysis_attempts: 1,
      error_message: null,
      failure_category: null,
    });
    expect(db().document_chunks).toEqual([
      expect.objectContaining({
        document_id: document.id,
        user_id: userA.id,
        content: "Lease text with enough content.",
      }),
    ]);
  });

  it("analyzes stored text documents without PDF extraction", async () => {
    const document = seedDocument(userA, {
      status: "pending",
      analysis_attempts: 0,
      title: "Pasted service agreement",
      file_name: "pasted-service-agreement.txt",
      mime_type: "text/plain",
      storage_path: `${userA.id}/doc-text/pasted-service-agreement.txt`,
    });
    const storedText = "Service agreement text with obligations, renewal terms, and payment details.";
    storageCalls().files.set(document.storage_path, {
      text: async () => storedText,
      type: "text/plain",
      size: storedText.length,
    } as Blob);
    analyzeDocumentMock.mockResolvedValue(analysisResult({ documentTitle: "Service agreement" }));
    const client = createSupabaseClient() as never;

    await runAnalysis(client, document.id, userA.id);

    expect(extractPdfTextMock).not.toHaveBeenCalled();
    expect(analyzeDocumentMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "Service agreement text with obligations, renewal terms, and payment details.",
      fileName: "pasted-service-agreement.txt",
      title: "Pasted service agreement",
    }));
    expect(db().documents[0]).toMatchObject({ status: "ready", title: "Pasted service agreement" });
  });

  it("keeps a user-chosen title through re-analysis but upgrades filename-derived defaults", async () => {
    const renamed = seedDocument(userA, {
      status: "pending",
      analysis_attempts: 0,
      title: "My car loan",
      file_name: "scan-2026.pdf",
    });
    seedStoredPdf(renamed.storage_path);
    extractPdfTextMock.mockResolvedValue("Loan text with enough content.");
    analyzeDocumentMock.mockResolvedValue(analysisResult({ documentTitle: "Vehicle financing agreement" }));
    const client = createSupabaseClient() as never;

    await runAnalysis(client, renamed.id, userA.id);
    expect(db().documents[0].title).toBe("My car loan");

    resetSupabaseMock(userA);
    const fresh = seedDocument(userA, {
      status: "pending",
      analysis_attempts: 0,
      title: "scan-2026",
      file_name: "scan-2026.pdf",
    });
    seedStoredPdf(fresh.storage_path);
    extractPdfTextMock.mockResolvedValue("Loan text with enough content.");
    analyzeDocumentMock.mockResolvedValue(analysisResult({ documentTitle: "Vehicle financing agreement" }));

    await runAnalysis(client, fresh.id, userA.id);
    expect(db().documents[0].title).toBe("Vehicle financing agreement");
  });

  it("marks the document failed with a category when extraction throws", async () => {
    const document = seedDocument(userA, { status: "pending", analysis_attempts: 0 });
    seedStoredPdf(document.storage_path);
    extractPdfTextMock.mockRejectedValue(new Error("PDF text extraction timed out."));
    const client = createSupabaseClient() as never;

    await expect(runAnalysis(client, document.id, userA.id)).rejects.toThrow("PDF text extraction timed out.");
    expect(db().documents[0]).toMatchObject({
      status: "failed",
      analysis_attempts: 1,
      failure_category: "extraction_timeout",
    });
  });
});

describe("markAnalysisFailed (attempt-token fencing)", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("is a no-op once a newer attempt has superseded the given token", async () => {
    const document = seedDocument(userA, {
      status: "analyzing",
      analysis_attempts: 2, // a newer attempt has already claimed (token 2)
      error_message: null,
    });
    const client = createSupabaseClient() as never;

    // A stale attempt (token 1) finally settles and tries to report failure.
    await markAnalysisFailed(client, document.id, userA.id, "stale failure", "unknown", 1);

    expect(db().documents[0]).toMatchObject({
      status: "analyzing",
      analysis_attempts: 2,
      error_message: null,
    });
  });

  it("applies when the token still matches the current attempt", async () => {
    const document = seedDocument(userA, { status: "analyzing", analysis_attempts: 1, error_message: null });
    const client = createSupabaseClient() as never;

    await markAnalysisFailed(client, document.id, userA.id, "current failure", "provider_error", 1);

    expect(db().documents[0]).toMatchObject({
      status: "failed",
      error_message: "current failure",
      failure_category: "provider_error",
    });
  });
});
