export type ReminderStatus = "suggested" | "approved" | "sent";
export type ReminderDeliveryStatus = "delivered" | "bounced" | "complained" | "pending";

export interface Reminder {
  id: string;
  docId: string;
  docTitle: string;
  title: string;
  description: string;
  fireOn: string;
  daysAway: number;
  status: ReminderStatus;
  channel: "Email";
  type: "Renewal" | "Notice" | "Payment" | "Review";
  reminderTime?: string | null;
  deliveryStatus?: ReminderDeliveryStatus;
}

export const reminders: Reminder[] = [
  {
    id: "r-1",
    docId: "greenfield-lease",
    docTitle: "Greenfield Apartments, Unit B12",
    title: "Lease non-renewal notice deadline",
    description:
      "60 days before your lease ends. Send written notice to avoid auto-renewal.",
    fireOn: "Jul 1, 2026",
    daysAway: 27,
    status: "suggested",
    channel: "Email",
    type: "Notice",
  },
  {
    id: "r-2",
    docId: "statefarm-auto",
    docTitle: "State Farm Auto Insurance Policy",
    title: "Auto insurance renewal",
    description:
      "Review coverage before policy renews automatically at the current rate.",
    fireOn: "Jun 14, 2026",
    daysAway: 11,
    status: "suggested",
    channel: "Email",
    type: "Renewal",
  },
  {
    id: "r-3",
    docId: "loft-gym",
    docTitle: "Loft Fitness Membership Terms",
    title: "Cancel gym before auto-renew (90-day window)",
    description:
      "Loft requires 90 days' written notice. This reminder fires 95 days before renewal.",
    fireOn: "Feb 24, 2026",
    daysAway: 12,
    status: "suggested",
    channel: "Email",
    type: "Notice",
  },
  {
    id: "r-4",
    docId: "acme-freelance",
    docTitle: "Acme Freelance Agreement",
    title: "Review new freelance terms",
    description: "Clausly flagged the IP and non-solicit clauses for your attention.",
    fireOn: "Jun 6, 2026",
    daysAway: 3,
    status: "suggested",
    channel: "Email",
    type: "Review",
  },
  {
    id: "r-5",
    docId: "greenfield-lease",
    docTitle: "Greenfield Apartments, Unit B12",
    title: "Lease ends, confirm move-out plan",
    description: "Confirm renewal or moving-out logistics 30 days before end.",
    fireOn: "Aug 1, 2026",
    daysAway: 59,
    status: "approved",
    channel: "Email",
    type: "Renewal",
  },
  {
    id: "r-6",
    docId: "verizon-wireless",
    docTitle: "Verizon Wireless Service Contract",
    title: "Verizon plan renewal",
    description: "Two-year contract ends. Re-shop plans 30 days before.",
    fireOn: "Feb 12, 2027",
    daysAway: 254,
    status: "approved",
    channel: "Email",
    type: "Renewal",
  },
  {
    id: "r-7",
    docId: "storage-bin-14",
    docTitle: "Northtown Storage, Bin 14",
    title: "Quarterly contents check",
    description: "Quarterly check on stored items. Clausly suggested this.",
    fireOn: "Sep 1, 2026",
    daysAway: 90,
    status: "approved",
    channel: "Email",
    type: "Review",
  },
  {
    id: "r-8",
    docId: "acme-employment",
    docTitle: "Acme Studios, Offer Letter",
    title: "Sign-on bonus clawback ends",
    description: "After this date, your $12,000 sign-on bonus is no longer repayable.",
    fireOn: "Feb 3, 2026",
    daysAway: -2,
    status: "sent",
    channel: "Email",
    type: "Review",
  },
  {
    id: "r-9",
    docId: "statefarm-auto",
    docTitle: "State Farm Auto Insurance Policy",
    title: "Confirm vehicle on policy",
    description: "Half-year check-in to make sure listed drivers and vehicles match.",
    fireOn: "Mar 14, 2026",
    daysAway: -82,
    status: "sent",
    channel: "Email",
    type: "Review",
  },
];

export const remindersByStatus = (s: ReminderStatus) =>
  reminders.filter((r) => r.status === s);
