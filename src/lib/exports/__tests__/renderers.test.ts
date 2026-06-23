import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { KeyDate } from "@/lib/db/types";
import { documents } from "@/lib/mock-data";
import type { Clause } from "@/lib/mock-clauses";
import type { Reminder } from "@/lib/mock-reminders";
import { clausesToCsv, datesToCsv } from "../csv";
import { renderDocumentPdf } from "../pdf";
import { buildExportZip } from "../zip";

const clause: Clause = {
  id: "clause-1",
  docId: "doc-1",
  title: "Payment, fees",
  category: "Payment",
  risk: "High",
  page: 3,
  quote: 'Tenant pays "all fees", including late fees.',
  plainEnglish: "You pay all fees.",
  whyItMatters: "This could be expensive.",
};

const date: KeyDate = {
  id: "date-1",
  documentId: "doc-1",
  clauseId: null,
  label: "Notice deadline",
  date: "2026-07-01",
  kind: "notice",
  description: "Send written notice.",
  sourceQuote: 'Notice by "July 1", 2026.',
  confidence: 0.9,
};

const reminder: Reminder = {
  id: "reminder-1",
  docId: "doc-1",
  docTitle: "Greenfield Apartments",
  title: "Send notice",
  description: "Send written notice before the deadline.",
  fireOn: "Jul 1, 2026",
  daysAway: 8,
  status: "approved",
  channel: "Email",
  type: "Notice",
};

describe("export renderers", () => {
  it("renders a non-empty PDF buffer", async () => {
    const buffer = await renderDocumentPdf({
      document: documents[0],
      clauses: [clause],
      dates: [date],
      reminders: [reminder],
    });

    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("serializes clauses to RFC-4180 CSV with escaped quotes and commas", () => {
    const csv = clausesToCsv([clause]);

    expect(csv).toContain("id,title,category,risk,page,quote,plain_english,why_it_matters\r\n");
    expect(csv).toContain('"Payment, fees"');
    expect(csv).toContain('"Tenant pays ""all fees"", including late fees."');
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("serializes dates to CSV with nullable fields as blanks", () => {
    const csv = datesToCsv([{ ...date, description: null, sourceQuote: null }]);

    expect(csv).toContain("date-1,Notice deadline,2026-07-01,notice,,");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("escapes newlines in CSV fields", () => {
    const csv = clausesToCsv([{ ...clause, plainEnglish: "Line one\nLine two" }]);

    expect(csv).toContain('"Line one\nLine two"');
  });

  it("builds a zip with clauses.csv and dates.csv", async () => {
    const buffer = await buildExportZip({
      clausesCsv: clausesToCsv([clause]),
      datesCsv: datesToCsv([date]),
    });

    const zip = await JSZip.loadAsync(buffer);
    await expect(zip.file("clauses.csv")?.async("string")).resolves.toContain("Payment, fees");
    await expect(zip.file("dates.csv")?.async("string")).resolves.toContain("Notice deadline");
  });

  it("keeps zip output non-empty", async () => {
    const buffer = await buildExportZip({
      clausesCsv: clausesToCsv([]),
      datesCsv: datesToCsv([]),
    });

    expect(buffer.length).toBeGreaterThan(100);
  });
});
