import type { RiskLevel } from "@/components/ui/risk-pill";

export type DocType =
  | "Lease"
  | "Insurance"
  | "Employment"
  | "Service"
  | "Loan"
  | "Subscription"
  | "NDA";

export interface ContractDoc {
  id: string;
  title: string;
  party: string;
  type: DocType;
  jurisdiction: string;
  pages: number;
  effective: string;
  ends: string;
  noticeBy?: string;
  risk: RiskLevel;
  uploadedDaysAgo: number;
  monthly?: string;
  summary: string;
  tags: string[];
}

export const documents: ContractDoc[] = [
  {
    id: "greenfield-lease",
    title: "Greenfield Apartments — Unit B12",
    party: "Greenfield Holdings LLC",
    type: "Lease",
    jurisdiction: "Minnesota",
    pages: 14,
    effective: "Sep 1, 2025",
    ends: "Aug 31, 2026",
    noticeBy: "Jul 1, 2026",
    risk: "Medium",
    uploadedDaysAgo: 3,
    monthly: "$1,850 / mo",
    summary:
      "12-month residential lease at $1,850/mo, beginning Sep 1, 2025. Auto-renews unless tenant provides 60 days' written notice. Minnesota law governs. Standard late-fee and early-termination clauses are present, with a higher-than-typical termination fee.",
    tags: ["Residential", "Auto-renew", "60-day notice"],
  },
  {
    id: "statefarm-auto",
    title: "State Farm Auto Insurance Policy",
    party: "State Farm Mutual Automobile Insurance Co.",
    type: "Insurance",
    jurisdiction: "Minnesota",
    pages: 22,
    effective: "Dec 14, 2025",
    ends: "Jun 14, 2026",
    risk: "Low",
    uploadedDaysAgo: 12,
    monthly: "$142 / mo",
    summary:
      "6-month personal auto policy. Liability 100/300/100, comprehensive and collision with $500 deductible each. Premium $142/month. Renews automatically; you can change coverage 30 days before the renewal date.",
    tags: ["Auto", "6 months", "Renewable"],
  },
  {
    id: "acme-freelance",
    title: "Acme Freelance Agreement",
    party: "Acme Studios, Inc.",
    type: "Service",
    jurisdiction: "California",
    pages: 9,
    effective: "Jan 1, 2026",
    ends: "Dec 31, 2026",
    risk: "Needs Review",
    uploadedDaysAgo: 1,
    monthly: "$6,500 / project",
    summary:
      "12-month independent contractor agreement. Includes a broad IP-assignment clause and a 30-mile, 12-month non-solicit. Termination for convenience by either party with 14 days' written notice.",
    tags: ["IP assignment", "Non-solicit", "California"],
  },
  {
    id: "verizon-wireless",
    title: "Verizon Wireless Service Contract",
    party: "Verizon Wireless",
    type: "Service",
    jurisdiction: "—",
    pages: 18,
    effective: "Mar 12, 2025",
    ends: "Mar 12, 2027",
    risk: "Low",
    uploadedDaysAgo: 47,
    monthly: "$85 / mo",
    summary:
      "24-month wireless service plan with $85/mo line charges and a $350 early-termination fee that decreases by ~$15/month. Arbitration clause with class-action waiver.",
    tags: ["Wireless", "Arbitration", "24 months"],
  },
  {
    id: "storage-bin-14",
    title: "Northtown Storage — Bin 14",
    party: "Northtown Self-Storage",
    type: "Lease",
    jurisdiction: "Minnesota",
    pages: 6,
    effective: "Oct 1, 2025",
    ends: "Oct 1, 2026",
    risk: "Low",
    uploadedDaysAgo: 28,
    monthly: "$78 / mo",
    summary:
      "Month-to-month storage rental at $78/mo. 10-day late grace period before auction notice. Renter responsible for own contents insurance.",
    tags: ["Storage", "Month-to-month"],
  },
  {
    id: "loft-gym",
    title: "Loft Fitness Membership Terms",
    party: "Loft Fitness Clubs",
    type: "Subscription",
    jurisdiction: "—",
    pages: 4,
    effective: "Jun 1, 2025",
    ends: "May 30, 2026",
    risk: "High",
    uploadedDaysAgo: 60,
    monthly: "$59 / mo",
    summary:
      "Annual membership with auto-renew. 90-day cancellation notice required to avoid renewal, an unusually long window. Initiation fee of $99 is non-refundable.",
    tags: ["Auto-renew", "90-day notice", "Non-refundable"],
  },
  {
    id: "acme-employment",
    title: "Acme Studios — Offer Letter",
    party: "Acme Studios, Inc.",
    type: "Employment",
    jurisdiction: "California",
    pages: 7,
    effective: "Feb 3, 2025",
    ends: "—",
    risk: "Medium",
    uploadedDaysAgo: 120,
    summary:
      "At-will employment offer with base $148,000, $12,000 sign-on (repayable if you leave within 12 months), and an arbitration agreement. Equity vests over 4 years with a 1-year cliff.",
    tags: ["At-will", "Sign-on clawback", "Vesting"],
  },
];

export const getDoc = (id: string) =>
  documents.find((d) => d.id === id) ?? documents[0];
