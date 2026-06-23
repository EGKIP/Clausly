import type { KeyDate } from "@/lib/db/types";
import type { Clause } from "@/lib/mock-clauses";

const CLAUSE_HEADERS = [
  "id",
  "title",
  "category",
  "risk",
  "page",
  "quote",
  "plain_english",
  "why_it_matters",
];

const DATE_HEADERS = [
  "id",
  "label",
  "date",
  "kind",
  "description",
  "source_quote",
];

export function clausesToCsv(clauses: Clause[]) {
  return toCsv([
    CLAUSE_HEADERS,
    ...clauses.map((clause) => [
      clause.id,
      clause.title,
      clause.category,
      clause.risk,
      String(clause.page),
      clause.quote,
      clause.plainEnglish,
      clause.whyItMatters,
    ]),
  ]);
}

export function datesToCsv(dates: KeyDate[]) {
  return toCsv([
    DATE_HEADERS,
    ...dates.map((date) => [
      date.id,
      date.label,
      date.date,
      date.kind,
      date.description ?? "",
      date.sourceQuote ?? "",
    ]),
  ]);
}

function toCsv(rows: string[][]) {
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n") + "\r\n";
}

function escapeCsvField(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}
