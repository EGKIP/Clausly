import type { Clause as UiClause } from "@/lib/mock-clauses";
import type { ContractDoc } from "@/lib/mock-data";
import type { Reminder as UiReminder, ReminderStatus } from "@/lib/mock-reminders";
import {
  apiRiskToUi,
  apiTypeToUi,
  type Clause,
  type ClauseRow,
  type DateRow,
  type Document,
  type DocumentRow,
  type KeyDate,
  type Reminder,
  type ReminderRow,
} from "./types";

export function toApiDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    title: row.title,
    type: row.document_type,
    jurisdiction: row.jurisdiction,
    uploadedAt: row.created_at,
    pageCount: row.page_count,
    storagePath: row.storage_path,
    status: row.status,
    riskLevel: row.risk_level,
    monthlyValue: row.monthly_value,
    endDate: row.end_date,
    noticeWindowDays: row.notice_window_days,
  };
}

export function toUiDocument(row: DocumentRow): ContractDoc {
  return {
    id: row.id,
    title: row.title,
    party: row.party ?? "Unknown party",
    type: apiTypeToUi[row.document_type],
    jurisdiction: row.jurisdiction ?? "—",
    pages: row.page_count,
    effective: formatDate(row.effective_date),
    ends: formatDate(row.end_date),
    noticeBy: row.end_date && row.notice_window_days
      ? formatDate(daysBefore(row.end_date, row.notice_window_days))
      : undefined,
    risk: row.risk_level ? apiRiskToUi[row.risk_level] : "Needs Review",
    uploadedDaysAgo: daysSince(row.created_at),
    monthly: row.monthly_value ? `$${Number(row.monthly_value).toLocaleString()} / mo` : undefined,
    summary: row.summary ?? row.summary_short ?? statusSummary(row.status),
    tags: row.tags.length > 0 ? row.tags : [statusLabel(row.status)],
  };
}

export function toApiClause(row: ClauseRow): Clause {
  return {
    id: row.id,
    documentId: row.document_id,
    title: row.title,
    category: normalizeClauseCategory(row.category),
    riskLevel: row.risk_level,
    page: row.page_number,
    sourceQuote: row.source_quote,
    plainEnglish: row.plain_english,
    whyItMatters: row.why_it_matters ?? "This clause may be worth reviewing in context.",
    confidence: row.confidence,
    bbox: isBbox(row.bbox) ? row.bbox : null,
  };
}

export function toUiClause(row: ClauseRow): UiClause {
  return {
    id: row.id,
    docId: row.document_id,
    title: row.title,
    category: normalizeClauseCategory(row.category),
    risk: apiRiskToUi[row.risk_level],
    page: row.page_number,
    quote: row.source_quote,
    plainEnglish: row.plain_english,
    whyItMatters: row.why_it_matters ?? "This clause may be worth reviewing in context.",
  };
}

export function toApiDate(row: DateRow): KeyDate {
  return {
    id: row.id,
    documentId: row.document_id,
    clauseId: row.clause_id,
    label: row.label,
    date: row.date_value,
    kind: row.kind,
    description: row.description,
    sourceQuote: row.source_quote,
    confidence: row.confidence,
  };
}

export function toApiReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    documentId: row.document_id,
    documentTitle: row.documents?.title ?? "Untitled document",
    title: row.title,
    description: row.description,
    fireOn: formatDate(row.fire_on),
    daysAway: daysUntil(row.fire_on),
    status: row.status,
    channel: "Email",
    type: normalizeReminderType(row.reminder_type),
    confidence: row.confidence,
    sourceQuote: row.source_quote,
  };
}

export function toUiReminder(row: ReminderRow): UiReminder {
  return {
    id: row.id,
    docId: row.document_id,
    docTitle: row.documents?.title ?? "Untitled document",
    title: row.title,
    description: row.description,
    fireOn: formatDate(row.fire_on),
    daysAway: daysUntil(row.fire_on),
    status: normalizeReminderStatus(row.status),
    channel: "Email",
    type: normalizeReminderType(row.reminder_type),
  };
}

function normalizeClauseCategory(category: string): UiClause["category"] {
  const options: UiClause["category"][] = [
    "Term",
    "Renewal",
    "Termination",
    "Payment",
    "Liability",
    "IP",
    "Dispute",
    "Privacy",
  ];
  const match = options.find((option) => option.toLowerCase() === category.toLowerCase());
  return match ?? "Term";
}

function normalizeReminderType(type: string): UiReminder["type"] {
  const options: UiReminder["type"][] = ["Renewal", "Notice", "Payment", "Review"];
  const match = options.find((option) => option.toLowerCase() === type.toLowerCase());
  return match ?? "Review";
}

function normalizeReminderStatus(status: ReminderRow["status"]): ReminderStatus {
  return status === "ignored" ? "suggested" : status;
}

function isBbox(value: unknown): value is [number, number, number, number] {
  return Array.isArray(value) && value.length === 4 && value.every((item) => typeof item === "number");
}

function daysBefore(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
}

function daysSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

function daysUntil(date: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(`${date}T00:00:00`);
  return Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function statusLabel(status: DocumentRow["status"]) {
  return status === "ready" ? "Ready" : status === "failed" ? "Needs attention" : "Processing";
}

function statusSummary(status: DocumentRow["status"]) {
  if (status === "pending") return "This document has been uploaded and is waiting for analysis.";
  if (status === "analyzing") return "Clausly is reading this document and preparing structured insights.";
  if (status === "failed") return "Analysis failed. Upload a clearer PDF or try again.";
  return "This document is ready.";
}
