import type { Database } from "@/lib/supabase/types";

type DocumentType = Database["public"]["Enums"]["document_type"];
type RiskLevel = Database["public"]["Enums"]["risk_level"];
type DateKind = Database["public"]["Enums"]["date_kind"];

export type SeedClause = {
  title: string;
  category: string;
  riskLevel: RiskLevel;
  page: number;
  sourceQuote: string;
  plainEnglish: string;
  whyItMatters: string;
  confidence: number;
  bbox: [number, number, number, number];
};

export type SeedDate = {
  label: string;
  date: string;
  kind: DateKind;
  description: string;
  sourceQuote: string;
  confidence: number;
};

export type SeedReminder = {
  title: string;
  description: string;
  fireOn: string;
  type: "Renewal" | "Notice" | "Payment" | "Review";
  sourceQuote: string;
  confidence: number;
};

export type SeedDoc = {
  title: string;
  party: string;
  type: DocumentType;
  jurisdiction: string;
  pageCount: number;
  riskLevel: RiskLevel;
  monthlyValue: number | null;
  effectiveDate: string;
  endDate: string | null;
  noticeWindowDays: number | null;
  summary: string;
  tags: string[];
  clauses: SeedClause[];
  dates: SeedDate[];
  reminder: SeedReminder;
};

export function getDemoDocuments(): SeedDoc[] {
  return [
    {
      title: "Demo Lease, Cedar House Unit 4B",
      party: "Cedar House Properties LLC",
      type: "lease",
      jurisdiction: "Minnesota",
      pageCount: 12,
      riskLevel: "medium",
      monthlyValue: 1725,
      effectiveDate: "2026-09-01",
      endDate: "2027-08-31",
      noticeWindowDays: 60,
      summary: "Demo residential lease with a 12-month term, monthly rent, late fee language, and a 60-day notice window before renewal.",
      tags: ["Demo", "Residential", "60-day notice"],
      clauses: [
        {
          title: "Non-renewal notice",
          category: "Renewal",
          riskLevel: "medium",
          page: 4,
          sourceQuote: "Tenant must provide written notice at least sixty (60) days before the lease end date.",
          plainEnglish: "You need to send written notice 60 days before the lease ends if you do not want to renew.",
          whyItMatters: "Missing this window can keep you responsible for rent longer than expected.",
          confidence: 0.91,
          bbox: [0.14, 0.2, 0.72, 0.1],
        },
        {
          title: "Late fee",
          category: "Payment",
          riskLevel: "medium",
          page: 6,
          sourceQuote: "Rent received after the fifth day of the month is subject to a fee equal to 7% of monthly rent.",
          plainEnglish: "Paying after the 5th may add a late fee.",
          whyItMatters: "A recurring reminder can reduce avoidable fees.",
          confidence: 0.88,
          bbox: [0.18, 0.42, 0.66, 0.09],
        },
      ],
      dates: [
        {
          label: "Lease end date",
          date: "2027-08-31",
          kind: "end",
          description: "The demo lease term ends on this date.",
          sourceQuote: "The lease term ends August 31, 2027.",
          confidence: 0.94,
        },
      ],
      reminder: {
        title: "Demo lease notice window",
        description: "Review whether to renew or send written notice before the 60-day window closes.",
        fireOn: "2027-07-02",
        type: "Notice",
        sourceQuote: "Tenant must provide written notice at least sixty (60) days before the lease end date.",
        confidence: 0.9,
      },
    },
    {
      title: "Demo Auto Policy, North Star Mutual",
      party: "North Star Mutual Insurance",
      type: "auto",
      jurisdiction: "Minnesota",
      pageCount: 18,
      riskLevel: "low",
      monthlyValue: 146,
      effectiveDate: "2026-06-15",
      endDate: "2026-12-15",
      noticeWindowDays: 30,
      summary: "Demo six-month auto insurance policy with renewal terms, deductible details, and a monthly premium.",
      tags: ["Demo", "Insurance", "Renewal"],
      clauses: [
        {
          title: "Policy renewal",
          category: "Renewal",
          riskLevel: "low",
          page: 3,
          sourceQuote: "This policy renews for successive six-month periods unless cancelled by either party.",
          plainEnglish: "The policy can renew automatically every six months.",
          whyItMatters: "Renewal is a good time to compare rates and coverage.",
          confidence: 0.87,
          bbox: [0.13, 0.28, 0.7, 0.08],
        },
        {
          title: "Collision deductible",
          category: "Payment",
          riskLevel: "low",
          page: 8,
          sourceQuote: "Collision coverage is subject to a $500 deductible per covered loss.",
          plainEnglish: "You may pay the first $500 of a covered collision claim.",
          whyItMatters: "Deductibles affect out-of-pocket costs after an accident.",
          confidence: 0.93,
          bbox: [0.16, 0.35, 0.68, 0.07],
        },
      ],
      dates: [
        {
          label: "Policy renewal date",
          date: "2026-12-15",
          kind: "renewal",
          description: "The demo policy renews on this date unless changed or cancelled.",
          sourceQuote: "The policy period ends December 15, 2026.",
          confidence: 0.92,
        },
      ],
      reminder: {
        title: "Demo auto policy renewal review",
        description: "Compare coverage and premiums before the policy renews.",
        fireOn: "2026-11-15",
        type: "Renewal",
        sourceQuote: "This policy renews for successive six-month periods unless cancelled by either party.",
        confidence: 0.86,
      },
    },
    {
      title: "Demo NDA, Pine Labs Mutual Review",
      party: "Pine Labs Cooperative",
      type: "nda",
      jurisdiction: "Delaware",
      pageCount: 7,
      riskLevel: "needs_review",
      monthlyValue: null,
      effectiveDate: "2026-05-01",
      endDate: "2028-05-01",
      noticeWindowDays: null,
      summary: "Demo mutual NDA with confidentiality obligations, permitted disclosures, and a two-year survival period.",
      tags: ["Demo", "NDA", "Confidentiality"],
      clauses: [
        {
          title: "Confidentiality period",
          category: "Privacy",
          riskLevel: "medium",
          page: 2,
          sourceQuote: "Recipient shall protect Confidential Information for two (2) years after disclosure.",
          plainEnglish: "Confidentiality duties continue for two years after information is shared.",
          whyItMatters: "Survival periods can outlast the business conversation.",
          confidence: 0.9,
          bbox: [0.12, 0.24, 0.74, 0.08],
        },
        {
          title: "Injunctive relief",
          category: "Dispute",
          riskLevel: "needs_review",
          page: 6,
          sourceQuote: "Disclosing Party may seek injunctive relief for unauthorized disclosure.",
          plainEnglish: "The other party may ask a court to stop disclosure or misuse.",
          whyItMatters: "This is common, but worth understanding before sharing sensitive material.",
          confidence: 0.82,
          bbox: [0.2, 0.48, 0.58, 0.08],
        },
      ],
      dates: [
        {
          label: "Confidentiality survival ends",
          date: "2028-05-01",
          kind: "deadline",
          description: "The demo NDA confidentiality period appears to end on this date.",
          sourceQuote: "Recipient shall protect Confidential Information for two (2) years after disclosure.",
          confidence: 0.88,
        },
      ],
      reminder: {
        title: "Demo NDA survival period ends",
        description: "Review whether any confidentiality obligations still apply.",
        fireOn: "2028-04-01",
        type: "Review",
        sourceQuote: "Recipient shall protect Confidential Information for two (2) years after disclosure.",
        confidence: 0.84,
      },
    },
  ];
}
