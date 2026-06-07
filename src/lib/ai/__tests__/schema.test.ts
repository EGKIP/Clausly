import { describe, expect, it } from "vitest";
import { analysisResultSchema } from "../schema";

const baseResult = {
  documentTitle: "Apartment Lease",
  documentType: "lease",
  jurisdiction: "Minnesota",
  summaryShort: "Twelve-month residential lease.",
  summaryLong: "A residential lease with a 60-day notice window.",
  riskLevel: "Medium",
  riskReasons: ["Late fees included."],
  pageCount: 12,
  monthlyValue: 1725,
  effectiveDate: "2026-09-01",
  endDate: "2027-08-31",
  noticeWindowDays: 60,
  tags: ["Lease"],
  clauses: [
    {
      title: "Late fee",
      category: "Payment",
      riskLevel: "Medium",
      sourcePage: 6,
      sourceText: "Rent is subject to a late fee.",
      plainEnglish: "Paying late may add a fee.",
      whyItMatters: "Reduces avoidable fees.",
      confidence: 0.88,
    },
  ],
  importantDates: [
    {
      title: "Lease end date",
      date: "2027-08-31",
      description: "The lease term ends.",
      sourcePage: 1,
      sourceText: "Term ends August 31.",
      kind: "end",
      confidence: 0.94,
    },
  ],
  suggestedReminders: [
    {
      title: "Send notice",
      date: "2027-07-02",
      description: "Send written notice.",
      type: "Notice",
      defaultReminderOffsets: ["30_days_before"],
      sourceText: "Notice required 60 days before end.",
      confidence: 0.9,
    },
  ],
};

describe("analysisResultSchema", () => {
  it("accepts a complete valid payload", () => {
    const parsed = analysisResultSchema.parse(baseResult);
    expect(parsed.documentTitle).toBe("Apartment Lease");
    expect(parsed.clauses).toHaveLength(1);
  });

  it("applies defaults for optional fields", () => {
    const minimal = {
      documentTitle: "Doc",
      documentType: "other",
      summaryShort: "Short summary.",
      riskLevel: "Low",
    };
    const parsed = analysisResultSchema.parse(minimal);
    expect(parsed.clauses).toEqual([]);
    expect(parsed.importantDates).toEqual([]);
    expect(parsed.suggestedReminders).toEqual([]);
    expect(parsed.tags).toEqual([]);
    expect(parsed.jurisdiction).toBeNull();
  });

  it("rejects an unknown documentType", () => {
    const bad = { ...baseResult, documentType: "spaceship" };
    expect(() => analysisResultSchema.parse(bad)).toThrow();
  });

  it("rejects an unknown riskLevel", () => {
    const bad = { ...baseResult, riskLevel: "Catastrophic" };
    expect(() => analysisResultSchema.parse(bad)).toThrow();
  });

  it("rejects a malformed effectiveDate", () => {
    const bad = { ...baseResult, effectiveDate: "09-01-2026" };
    expect(() => analysisResultSchema.parse(bad)).toThrow();
  });

  it("rejects confidence above 1", () => {
    const bad = {
      ...baseResult,
      clauses: [{ ...baseResult.clauses[0], confidence: 1.5 }],
    };
    expect(() => analysisResultSchema.parse(bad)).toThrow();
  });

  it("rejects unknown reminder offsets", () => {
    const bad = {
      ...baseResult,
      suggestedReminders: [{ ...baseResult.suggestedReminders[0], defaultReminderOffsets: ["10_minutes_before"] }],
    };
    expect(() => analysisResultSchema.parse(bad)).toThrow();
  });

  it("rejects unknown extra keys via strict()", () => {
    const bad = { ...baseResult, mystery: "field" };
    expect(() => analysisResultSchema.parse(bad)).toThrow();
  });
});
