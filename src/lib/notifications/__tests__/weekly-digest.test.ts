import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDigestForUser,
} from "../weekly-digest";
import type { ServiceSupabaseClient } from "../supabase-service";
import {
  buildWeeklyDigestUnsubscribeUrl,
  renderWeeklyDigestEmail,
} from "../templates";
import {
  createSupabaseClient,
  resetSupabaseMock,
  seedClause,
  seedDocument,
  seedReminder,
  seedUser,
  userA,
  userB,
} from "../../../../tests/helpers/supabase";

vi.mock("server-only", () => ({}));

const now = new Date("2026-06-22T14:00:00.000Z");

describe("weekly digest builder", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    seedUser(userA, {
      full_name: "Ada",
      notification_preferences: { email: true, weekly_digest: true, version: 3 },
      weekly_digest_sent_at: "2026-06-19T14:00:00.000Z",
    });
  });

  it("collects approved reminders due this week", async () => {
    const document = seedDocument(userA, { title: "Office Lease" });
    seedReminder(document.id, userA, {
      id: "reminder-this-week",
      status: "approved",
      fire_on: "2026-06-25",
      title: "Send renewal notice",
    });
    seedReminder(document.id, userA, {
      id: "reminder-later",
      status: "approved",
      fire_on: "2026-07-05",
    });

    const digest = await buildDigestForUser(testClient(), userA.id, now);

    expect(digest.deadlinesThisWeek).toHaveLength(1);
    expect(digest.deadlinesThisWeek[0]).toMatchObject({
      id: "reminder-this-week",
      documentTitle: "Office Lease",
      fireOn: "2026-06-25",
    });
  });

  it("collects approved reminders due after this week but inside 30 days", async () => {
    const document = seedDocument(userA, { title: "Vendor MSA" });
    seedReminder(document.id, userA, {
      id: "reminder-next-30",
      status: "approved",
      fire_on: "2026-07-10",
    });

    const digest = await buildDigestForUser(testClient(), userA.id, now);

    expect(digest.deadlinesThisWeek).toHaveLength(0);
    expect(digest.deadlinesNext30).toHaveLength(1);
    expect(digest.deadlinesNext30[0].documentTitle).toBe("Vendor MSA");
  });

  it("collects recent uploads from the last seven days", async () => {
    seedDocument(userA, {
      id: "recent-doc",
      title: "Recent NDA",
      document_type: "nda",
      created_at: "2026-06-20T12:00:00.000Z",
    });
    seedDocument(userA, {
      id: "old-doc",
      title: "Old Lease",
      created_at: "2026-06-01T12:00:00.000Z",
    });

    const digest = await buildDigestForUser(testClient(), userA.id, now);

    expect(digest.recentUploads).toEqual([
      expect.objectContaining({ id: "recent-doc", title: "Recent NDA", documentType: "nda" }),
    ]);
  });

  it("collects high-risk clauses since the last digest", async () => {
    const document = seedDocument(userA, { title: "Risky Lease" });
    seedClause(document.id, userA, {
      id: "high-clause",
      title: "Termination fee",
      risk_level: "high",
      created_at: "2026-06-20T12:00:00.000Z",
    });
    seedClause(document.id, userA, {
      id: "medium-clause",
      risk_level: "medium",
      created_at: "2026-06-20T12:00:00.000Z",
    });
    seedClause(document.id, userA, {
      id: "old-high-clause",
      risk_level: "high",
      created_at: "2026-06-10T12:00:00.000Z",
    });

    const digest = await buildDigestForUser(testClient(), userA.id, now);

    expect(digest.newHighRiskClauses).toHaveLength(1);
    expect(digest.newHighRiskClauses[0]).toMatchObject({
      id: "high-clause",
      documentTitle: "Risky Lease",
      riskLevel: "high",
    });
  });

  it("falls back to the last seven days for high-risk clauses when no prior digest exists", async () => {
    resetSupabaseMock(userA);
    seedUser(userA, {
      notification_preferences: { email: true, weekly_digest: true },
      weekly_digest_sent_at: null,
    });
    const document = seedDocument(userA);
    seedClause(document.id, userA, {
      id: "needs-review",
      risk_level: "needs_review",
      created_at: "2026-06-18T12:00:00.000Z",
    });
    seedUser(userB, { notification_preferences: { email: true } });
    const otherDocument = seedDocument(userB);
    seedClause(otherDocument.id, userB, {
      id: "other-user-risk",
      risk_level: "high",
      created_at: "2026-06-18T12:00:00.000Z",
    });

    const digest = await buildDigestForUser(testClient(), userA.id, now);

    expect(digest.newHighRiskClauses).toHaveLength(1);
    expect(digest.newHighRiskClauses[0].id).toBe("needs-review");
  });
});

function testClient() {
  return createSupabaseClient() as unknown as ServiceSupabaseClient;
}

describe("weekly digest email template", () => {
  it("renders required sections, disclaimer, and typed unsubscribe link", () => {
    const unsubscribeUrl = buildWeeklyDigestUnsubscribeUrl({
      baseUrl: "https://clausly.test/",
      userId: userA.id,
      preferences: { version: 3 },
      secret: "unsubscribe-secret",
    });
    const template = renderWeeklyDigestEmail({
      userName: "Ada",
      dashboardUrl: "https://clausly.test/dashboard",
      unsubscribeUrl,
      deadlinesThisWeek: [{
        title: "Send renewal notice",
        documentTitle: "Office Lease",
        fireOn: "2026-06-25",
        description: "Review the notice window.",
        documentUrl: "https://clausly.test/dashboard/documents/doc-1",
      }],
      deadlinesNext30: [],
      recentUploads: [{
        title: "Recent NDA",
        documentType: "nda",
        createdAt: "2026-06-20T12:00:00.000Z",
        documentUrl: "https://clausly.test/dashboard/documents/doc-2",
      }],
      newHighRiskClauses: [{
        title: "Termination fee",
        documentTitle: "Risky Lease",
        riskLevel: "high",
        pageNumber: 3,
        sourceQuote: "Tenant must pay a termination fee.",
        documentUrl: "https://clausly.test/dashboard/documents/doc-3",
      }],
    });

    expect(unsubscribeUrl).toContain("type=weekly_digest");
    expect(template.subject).toBe("Your Clausly weekly contract digest");
    expect(template.html).toContain("Clausly Pro");
    expect(template.html).toContain("Send renewal notice");
    expect(template.html).toContain("Recent NDA");
    expect(template.html).toContain("Termination fee");
    expect(template.text).toContain("This digest is informational only and is not legal advice.");
    expect(template.text).toContain("Unsubscribe: https://clausly.test/api/notifications/unsubscribe");
  });
});
