import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  resetSupabaseMock,
  seedClause,
  seedDate,
  seedDocument,
  seedReminder,
  userA,
  userB,
} from "@/../tests/helpers/supabase";
import { persistAnalysis } from "../persistence";
import type { AnalysisResult } from "../schema";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));

function result(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    documentTitle: "Fresh lease analysis",
    documentType: "lease",
    jurisdiction: "Minnesota",
    summaryShort: "Fresh summary.",
    summaryLong: "Fresh longer summary.",
    riskLevel: "Medium",
    riskReasons: ["Fresh reason"],
    pageCount: 3,
    monthlyValue: 1800,
    effectiveDate: "2026-09-01",
    endDate: "2027-08-31",
    noticeWindowDays: 60,
    tags: ["AI Preview", "Lease"],
    clauses: [
      {
        title: "Fresh notice window",
        category: "Renewal",
        riskLevel: "Medium",
        sourcePage: 1,
        sourceText: "Fresh notice source.",
        plainEnglish: "Fresh notice plain English.",
        whyItMatters: "Fresh why it matters.",
        confidence: 0.9,
      },
    ],
    importantDates: [
      {
        title: "Fresh end date",
        date: "2027-08-31",
        description: "Fresh date description.",
        sourcePage: 1,
        sourceText: "Fresh date source.",
        kind: "end",
        confidence: 0.86,
      },
    ],
    suggestedReminders: [
      {
        title: "Fresh reminder",
        date: "2027-07-02",
        description: "Fresh reminder description.",
        type: "Notice",
        defaultReminderOffsets: ["30_days_before"],
        sourceText: "Fresh reminder source.",
        confidence: 0.82,
      },
    ],
    ...overrides,
  };
}

describe("persistAnalysis", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("clears stale extracted rows before inserting the new snapshot", async () => {
    const document = seedDocument(userA, { status: "failed" });
    seedClause(document.id, userA, { title: "Stale clause A" });
    seedClause(document.id, userA, { title: "Stale clause B" });
    seedClause(document.id, userA, { title: "Stale clause C" });
    seedDate(document.id, userA, { label: "Stale date A" });
    seedDate(document.id, userA, { label: "Stale date B" });
    seedReminder(document.id, userA, { title: "Stale reminder" });

    const persisted = await persistAnalysis(createSupabaseClient() as never, document.id, userA.id, result(), 0);

    expect(persisted.clauseIds).toHaveLength(1);
    expect(persisted.dateIds).toHaveLength(1);
    expect(persisted.reminderIds).toHaveLength(1);
    expect(db().clauses).toHaveLength(1);
    expect(db().dates).toHaveLength(1);
    expect(db().reminders).toHaveLength(1);
    expect(db().clauses[0]).toMatchObject({ title: "Fresh notice window", document_id: document.id, user_id: userA.id });
    expect(db().dates[0]).toMatchObject({ label: "Fresh end date", document_id: document.id, user_id: userA.id });
    expect(db().reminders[0]).toMatchObject({ title: "Fresh reminder", document_id: document.id, user_id: userA.id });
    expect(db().documents[0]).toMatchObject({ id: document.id, status: "ready", error_message: null });
  });

  it("does not clear another user document snapshot", async () => {
    const documentA = seedDocument(userA, { status: "failed" });
    const documentB = seedDocument(userB, { status: "ready" });
    seedClause(documentA.id, userA, { title: "Stale user A clause" });
    const userBClause = seedClause(documentB.id, userB, { title: "User B clause" });

    await persistAnalysis(createSupabaseClient() as never, documentA.id, userA.id, result(), 0);

    expect(db().clauses).toEqual([
      expect.objectContaining({ title: "User B clause", id: userBClause.id, document_id: documentB.id, user_id: userB.id }),
      expect.objectContaining({ title: "Fresh notice window", document_id: documentA.id, user_id: userA.id }),
    ]);
  });

  it("does not overwrite a newer attempt's document-level fields when the token is stale", async () => {
    const document = seedDocument(userA, {
      status: "ready",
      analysis_attempts: 2,
      summary: "Summary from the newer attempt",
      title: "Newer title",
    });

    // attemptToken 1 is stale — a newer attempt (token 2) has already
    // claimed and presumably completed by the time this one finishes.
    await persistAnalysis(createSupabaseClient() as never, document.id, userA.id, result(), 1);

    expect(db().documents[0]).toMatchObject({
      status: "ready",
      summary: "Summary from the newer attempt",
      title: "Newer title",
      analysis_attempts: 2,
    });
  });
});
