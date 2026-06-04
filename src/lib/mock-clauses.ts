import type { RiskLevel } from "@/components/ui/risk-pill";

export interface Clause {
  id: string;
  docId: string;
  title: string;
  category:
    | "Term"
    | "Renewal"
    | "Termination"
    | "Payment"
    | "Liability"
    | "IP"
    | "Dispute"
    | "Privacy";
  risk: RiskLevel;
  page: number;
  quote: string;
  plainEnglish: string;
  whyItMatters: string;
}

export const clauses: Clause[] = [
  {
    id: "gf-1",
    docId: "greenfield-lease",
    title: "Auto-renewal",
    category: "Renewal",
    risk: "Medium",
    page: 4,
    quote:
      "Upon expiration of the initial term, this Lease shall automatically renew on a month-to-month basis unless either party provides written notice of non-renewal at least sixty (60) days prior to the expiration date.",
    plainEnglish:
      "Your lease keeps going unless you tell the landlord, in writing, at least 60 days before it ends.",
    whyItMatters:
      "If you miss the 60-day window, you're stuck on a month-to-month at the new rate, which is usually higher.",
  },
  {
    id: "gf-2",
    docId: "greenfield-lease",
    title: "Late payment fee",
    category: "Payment",
    risk: "Medium",
    page: 6,
    quote:
      "Rent paid after the 5th calendar day of the month shall incur a late fee of 8% of the monthly rent.",
    plainEnglish: "Pay after the 5th and you owe an extra $148.",
    whyItMatters:
      "8% is on the higher end for Minnesota. Set a reminder to pay before the 5th.",
  },
  {
    id: "gf-3",
    docId: "greenfield-lease",
    title: "Early termination",
    category: "Termination",
    risk: "High",
    page: 9,
    quote:
      "Tenant may terminate this Lease prior to expiration only upon payment of an early termination fee equal to two (2) months' rent plus forfeiture of the security deposit.",
    plainEnglish: "Leaving early costs $3,700 plus your $1,850 deposit.",
    whyItMatters:
      "That's roughly $5,550 to break the lease. If there's any chance you'll move, factor this in now.",
  },
  {
    id: "gf-4",
    docId: "greenfield-lease",
    title: "Security deposit",
    category: "Payment",
    risk: "Low",
    page: 2,
    quote:
      "A security deposit of $1,850 shall be held by Landlord and returned within 21 days of move-out, less any lawful deductions.",
    plainEnglish: "Your $1,850 deposit comes back within 21 days of moving out.",
    whyItMatters:
      "Minnesota law requires deposit return within 21 days. This matches state law.",
  },
  {
    id: "gf-5",
    docId: "greenfield-lease",
    title: "Quiet enjoyment & entry",
    category: "Privacy",
    risk: "Low",
    page: 8,
    quote:
      "Landlord shall provide twenty-four (24) hours' notice before entering the Premises except in cases of emergency.",
    plainEnglish: "Your landlord must give 24 hours' notice before coming in.",
    whyItMatters: "Standard and tenant-friendly.",
  },
];

export const getClausesFor = (docId: string) =>
  clauses.filter((c) => c.docId === docId);
