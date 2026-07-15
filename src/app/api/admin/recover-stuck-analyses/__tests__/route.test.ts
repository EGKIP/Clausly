import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createServiceSupabaseClientMock,
  db,
  resetSupabaseMock,
  seedDocument,
  seedStoredPdf,
  userA,
} from "@/../tests/helpers/supabase";
import type { AnalysisResult } from "@/lib/ai/schema";

vi.mock("@/lib/notifications/supabase-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notifications/supabase-service")>();
  return { ...actual, createServiceSupabaseClient: () => createServiceSupabaseClientMock() };
});
vi.mock("@/lib/ai/pdf-text", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/pdf-text")>();
  return { extractPdfText: vi.fn(), NoTextLayerError: actual.NoTextLayerError };
});
vi.mock("@/lib/ai/provider", () => ({
  analyzeDocument: vi.fn(),
  getAnalysisProvider: () => "mock",
  getAnalysisModel: () => "mock",
}));
vi.mock("@/lib/ai/run-analysis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/run-analysis")>();
  return { ...actual, claimAnalysisAttempt: vi.fn(actual.claimAnalysisAttempt) };
});

import { extractPdfText } from "@/lib/ai/pdf-text";
import { analyzeDocument } from "@/lib/ai/provider";
import { claimAnalysisAttempt } from "@/lib/ai/run-analysis";
import { GET, POST } from "../route";

const extractPdfTextMock = vi.mocked(extractPdfText);
const analyzeDocumentMock = vi.mocked(analyzeDocument);
const claimAnalysisAttemptMock = vi.mocked(claimAnalysisAttempt);

function analysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    documentTitle: "Recovered lease",
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

function request() {
  return new Request("https://clausly.test/api/admin/recover-stuck-analyses", {
    method: "POST",
    headers: { Authorization: "Bearer dispatch-secret" },
  });
}

const NOW = "2026-06-01T00:30:00.000Z";
const STALE_STARTED_AT = "2026-06-01T00:00:00.000Z"; // 30 min before NOW — past the 10 min threshold
const FRESH_STARTED_AT = "2026-06-01T00:25:00.000Z"; // 5 min before NOW — within the threshold

describe("/api/admin/recover-stuck-analyses", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    extractPdfTextMock.mockReset();
    analyzeDocumentMock.mockReset();
    claimAnalysisAttemptMock.mockClear();
    vi.setSystemTime(new Date(NOW));
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    process.env.CLAUSLY_DISPATCH_SECRET = "dispatch-secret";
    delete process.env.CRON_SECRET;
  });

  it("rejects unauthorized requests", async () => {
    const response = await POST(
      new Request("https://clausly.test/api/admin/recover-stuck-analyses", { method: "POST" })
    );

    expect(response.status).toBe(401);
  });

  it("returns 503 when service role env is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await POST(request());

    expect(response.status).toBe(503);
  });

  it("retries a stuck document under the attempt cap and leaves it ready", async () => {
    const document = seedDocument(userA, {
      status: "analyzing",
      analysis_attempts: 1,
      analysis_started_at: STALE_STARTED_AT,
    });
    seedStoredPdf(document.storage_path);
    extractPdfTextMock.mockResolvedValue("Lease text with enough content.");
    analyzeDocumentMock.mockResolvedValue(analysisResult());

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ found: 1, retried: 1, gaveUp: 0, skipped: 0 });
    expect(db().documents[0]).toMatchObject({ status: "ready", analysis_attempts: 2 });
  });

  it("gives up on a document that exhausted its attempts", async () => {
    const document = seedDocument(userA, {
      status: "analyzing",
      analysis_attempts: 3,
      analysis_started_at: STALE_STARTED_AT,
    });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ found: 1, retried: 0, gaveUp: 1, skipped: 0 });
    expect(db().documents[0]).toMatchObject({
      id: document.id,
      status: "failed",
      failure_category: "stuck_timeout",
      analysis_attempts: 3,
    });
    expect(extractPdfTextMock).not.toHaveBeenCalled();
  });

  it("leaves a recently-started analyzing document alone", async () => {
    seedDocument(userA, {
      status: "analyzing",
      analysis_attempts: 1,
      analysis_started_at: FRESH_STARTED_AT,
    });

    const response = await POST(request());
    const body = await response.json();

    expect(body).toEqual({ found: 0, retried: 0, gaveUp: 0, skipped: 0 });
    expect(db().documents[0]).toMatchObject({ status: "analyzing", analysis_attempts: 1 });
  });

  it("skips a candidate that something else already resolved before the claim ran", async () => {
    const document = seedDocument(userA, {
      status: "analyzing",
      analysis_attempts: 1,
      analysis_started_at: STALE_STARTED_AT,
    });
    claimAnalysisAttemptMock.mockResolvedValueOnce({ claimed: false });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ found: 1, retried: 0, gaveUp: 0, skipped: 1 });
    // Untouched — the mocked claim never actually wrote anything.
    expect(db().documents[0]).toMatchObject({ id: document.id, status: "analyzing", analysis_attempts: 1 });
  });

  it("responds to GET the same way, for Vercel Cron", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
  });
});
