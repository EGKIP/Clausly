import type { RiskLevel } from "@/components/ui/risk-pill";
import type { Clause as UiClause } from "@/lib/mock-clauses";
import type { ContractDoc, DocType } from "@/lib/mock-data";
import type { Reminder as UiReminder, ReminderStatus } from "@/lib/mock-reminders";
import type { Database } from "@/lib/supabase/types";

export type DocumentType = Database["public"]["Enums"]["document_type"];
export type DocumentStatus = Database["public"]["Enums"]["document_status"];
export type KeyDateKind = Database["public"]["Enums"]["date_kind"];

export type Document = {
  id: string;
  title: string;
  type: DocumentType;
  jurisdiction: string | null;
  uploadedAt: string;
  pageCount: number;
  storagePath: string;
  status: DocumentStatus;
  riskLevel: "low" | "medium" | "high" | "needs_review" | null;
  monthlyValue: number | null;
  endDate: string | null;
  noticeWindowDays: number | null;
};

export type Clause = {
  id: string;
  documentId: string;
  title: string;
  category: UiClause["category"];
  riskLevel: "low" | "medium" | "high" | "needs_review";
  page: number;
  sourceQuote: string;
  plainEnglish: string;
  whyItMatters: string;
  confidence: number | null;
  bbox: [number, number, number, number] | null;
};

export type KeyDate = {
  id: string;
  documentId: string;
  clauseId: string | null;
  label: string;
  date: string;
  kind: KeyDateKind;
  description: string | null;
  sourceQuote: string | null;
  confidence: number | null;
};

export type Reminder = {
  id: string;
  documentId: string;
  documentTitle: string;
  title: string;
  description: string;
  fireOn: string;
  daysAway: number;
  status: ReminderStatus | "ignored";
  channel: "Email";
  type: UiReminder["type"];
  confidence: number | null;
  sourceQuote: string | null;
};

export type DocumentDetail = {
  document: ContractDoc;
  status: DocumentStatus;
  errorMessage: string | null;
  clauses: UiClause[];
  dates: KeyDate[];
  reminders: UiReminder[];
  signedUrl: string | null;
};

export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type ClauseRow = Database["public"]["Tables"]["clauses"]["Row"];
export type DateRow = Database["public"]["Tables"]["dates"]["Row"];
export type ReminderRow = Database["public"]["Tables"]["reminders"]["Row"] & {
  documents?: Pick<DocumentRow, "title"> | null;
};

export const apiTypeToUi: Record<DocumentType, DocType> = {
  lease: "Lease",
  auto: "Insurance",
  employment: "Employment",
  service: "Service",
  nda: "NDA",
  other: "Service",
};

export const uiTypeToApi: Partial<Record<DocType, DocumentType>> = {
  Lease: "lease",
  Insurance: "auto",
  Employment: "employment",
  Service: "service",
  NDA: "nda",
  Loan: "other",
  Subscription: "service",
};

export const apiRiskToUi: Record<NonNullable<DocumentRow["risk_level"]>, RiskLevel> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  needs_review: "Needs Review",
};

export const uiRiskToApi: Record<RiskLevel, NonNullable<DocumentRow["risk_level"]>> = {
  Low: "low",
  Medium: "medium",
  High: "high",
  "Needs Review": "needs_review",
};
