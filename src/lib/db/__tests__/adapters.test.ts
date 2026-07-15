import { describe, expect, it, vi } from "vitest";
import { toApiClause, toApiDocument, toUiClause, toUiDocument } from "../adapters";
import type { ClauseRow, DocumentRow } from "../types";

vi.setSystemTime(new Date("2026-06-06T12:00:00Z"));

const riskLevels = ["low", "medium", "high", "needs_review"] as const;

function documentRow(risk_level: DocumentRow["risk_level"], tags: string[] | null = ["Demo"]): DocumentRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "22222222-2222-4222-8222-222222222222",
    title: "Sample Lease",
    party: "Sample LLC",
    document_type: "lease",
    jurisdiction: "Minnesota",
    page_count: 8,
    storage_path: "user/doc/original.pdf",
    file_name: "lease.pdf",
    mime_type: "application/pdf",
    file_size_bytes: 1200,
    status: "ready",
    risk_level,
    monthly_value: 1850,
    effective_date: "2026-01-01",
    end_date: "2026-12-31",
    notice_window_days: 60,
    summary_short: "Short summary",
    summary: "Full summary",
    tags: tags as DocumentRow["tags"],
    error_message: null,
    analysis_started_at: null,
    analysis_attempts: 0,
    failure_category: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  };
}

function clauseRow(risk_level: ClauseRow["risk_level"], bbox: unknown = [0.1, 0.2, 0.3, 0.4]): ClauseRow {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    user_id: "22222222-2222-4222-8222-222222222222",
    document_id: "11111111-1111-4111-8111-111111111111",
    title: "Renewal",
    category: "Renewal",
    risk_level,
    page_number: 4,
    source_quote: "Auto-renews unless notice is given.",
    plain_english: "This renews automatically.",
    why_it_matters: null,
    confidence: 0.9,
    bbox: bbox as ClauseRow["bbox"],
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  };
}

describe("document adapters", () => {
  it.each(riskLevels)("preserves and displays risk level %s", (riskLevel) => {
    const api = toApiDocument(documentRow(riskLevel));
    const ui = toUiDocument(documentRow(riskLevel));

    expect(api.riskLevel).toBe(riskLevel);
    expect(ui.risk).toMatchSnapshot();
  });

  it("falls back to a status tag when tags are empty", () => {
    expect(toUiDocument(documentRow("low", [])).tags).toEqual(["Ready"]);
  });

  it("documents current null tag behavior", () => {
    expect(() => toUiDocument(documentRow("low", null))).toThrow();
  });
});

describe("clause adapters", () => {
  it.each(riskLevels)("preserves and displays clause risk level %s", (riskLevel) => {
    const api = toApiClause(clauseRow(riskLevel));
    const ui = toUiClause(clauseRow(riskLevel));

    expect(api.riskLevel).toBe(riskLevel);
    expect(ui.risk).toMatchSnapshot();
  });

  it("normalizes valid bbox arrays", () => {
    expect(toApiClause(clauseRow("medium", [0, 0.25, 0.5, 0.75])).bbox).toEqual([0, 0.25, 0.5, 0.75]);
    expect(toUiClause(clauseRow("medium", [0, 0.25, 0.5, 0.75])).bbox).toEqual([0, 0.25, 0.5, 0.75]);
  });

  it("drops invalid bbox values", () => {
    expect(toApiClause(clauseRow("medium", [0, 0.25, 0.5])).bbox).toBeNull();
    expect(toUiClause(clauseRow("medium", "not-a-box")).bbox).toBeNull();
  });
});
