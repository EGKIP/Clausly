import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDigestForUser,
  sendWeeklyDigests,
} from "../weekly-digest";
import type { EmailMessage, EmailProvider } from "../email-provider";
import type { ServiceSupabaseClient } from "../supabase-service";
import {
  buildWeeklyDigestUnsubscribeUrl,
  renderWeeklyDigestEmail,
} from "../templates";
import {
  createSupabaseClient,
  db,
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

class MockEmailProvider implements EmailProvider {
  public sent: EmailMessage[] = [];
  public shouldFail = false;

  async send(message: EmailMessage) {
    if (this.shouldFail) throw new Error("Resend unavailable.");
    this.sent.push(message);
    return { id: `email-${this.sent.length}` };
  }
}

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

describe("weekly digest send loop", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
  });

  it("sends a digest, inserts audit, and updates the user timestamp", async () => {
    seedUser(userA, {
      subscription_tier: "pro",
      full_name: "Ada",
      notification_preferences: { email: true, weekly_digest: true, version: 3 },
      weekly_digest_sent_at: null,
    });
    const document = seedDocument(userA, { title: "Office Lease", created_at: "2026-06-20T12:00:00.000Z" });
    seedReminder(document.id, userA, { status: "approved", fire_on: "2026-06-25" });
    seedClause(document.id, userA, { risk_level: "high", created_at: "2026-06-20T12:00:00.000Z" });
    const provider = new MockEmailProvider();

    const result = await sendWeeklyDigests(testClient(), {
      provider,
      now,
      baseUrl: "https://clausly.test",
      from: "Clausly <digest@clausly.test>",
      unsubscribeSecret: "unsubscribe-secret",
    });

    expect(result).toEqual({ processed: 1, sent: 1, skipped: 0, failed: 0 });
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0].html).toContain("type=weekly_digest");
    expect(db().weekly_digests).toEqual([
      expect.objectContaining({
        user_id: userA.id,
        deadline_count: 1,
        upload_count: 1,
        high_risk_count: 1,
        status: "sent",
      }),
    ]);
    expect(db().users[0].weekly_digest_sent_at).toBe(now.toISOString());
  });

  it("audits skipped digests when every section is empty", async () => {
    seedUser(userA, {
      subscription_tier: "pro",
      email: userA.email,
      notification_preferences: { email: true, weekly_digest: true },
    });
    const provider = new MockEmailProvider();

    const result = await sendWeeklyDigests(testClient(), {
      provider,
      now,
      baseUrl: "https://clausly.test",
      from: "Clausly <digest@clausly.test>",
      unsubscribeSecret: "unsubscribe-secret",
    });

    expect(result).toEqual({ processed: 1, sent: 0, skipped: 1, failed: 0 });
    expect(provider.sent).toHaveLength(0);
    expect(db().weekly_digests[0]).toMatchObject({ user_id: userA.id, status: "skipped" });
  });

  it("audits failed sends without updating weekly_digest_sent_at", async () => {
    seedUser(userA, {
      subscription_tier: "pro",
      notification_preferences: { email: true, weekly_digest: true },
      weekly_digest_sent_at: null,
    });
    const document = seedDocument(userA, { created_at: "2026-06-20T12:00:00.000Z" });
    seedReminder(document.id, userA, { status: "approved", fire_on: "2026-06-25" });
    const provider = new MockEmailProvider();
    provider.shouldFail = true;

    const result = await sendWeeklyDigests(testClient(), {
      provider,
      now,
      baseUrl: "https://clausly.test",
      from: "Clausly <digest@clausly.test>",
      unsubscribeSecret: "unsubscribe-secret",
    });

    expect(result).toEqual({ processed: 1, sent: 0, skipped: 0, failed: 1 });
    expect(db().weekly_digests[0]).toMatchObject({
      user_id: userA.id,
      status: "failed",
      error_message: "Resend unavailable.",
    });
    expect(db().users[0].weekly_digest_sent_at).toBeNull();
  });

  it("skips free users through the shared plan helper", async () => {
    seedUser(userA, {
      subscription_tier: "free",
      notification_preferences: { email: true, weekly_digest: true },
    });
    const document = seedDocument(userA, { created_at: "2026-06-20T12:00:00.000Z" });
    seedReminder(document.id, userA, { status: "approved", fire_on: "2026-06-25" });
    const provider = new MockEmailProvider();

    const result = await sendWeeklyDigests(testClient(), {
      provider,
      now,
      baseUrl: "https://clausly.test",
      from: "Clausly <digest@clausly.test>",
      unsubscribeSecret: "unsubscribe-secret",
    });

    expect(result).toEqual({ processed: 0, sent: 0, skipped: 0, failed: 0 });
    expect(provider.sent).toHaveLength(0);
    expect(db().weekly_digests).toHaveLength(0);
  });

  it("respects weekly digest notification preference", async () => {
    seedUser(userA, {
      subscription_tier: "pro",
      notification_preferences: { email: true, weekly_digest: false },
    });
    const document = seedDocument(userA, { created_at: "2026-06-20T12:00:00.000Z" });
    seedReminder(document.id, userA, { status: "approved", fire_on: "2026-06-25" });
    const provider = new MockEmailProvider();

    const result = await sendWeeklyDigests(testClient(), {
      provider,
      now,
      baseUrl: "https://clausly.test",
      from: "Clausly <digest@clausly.test>",
      unsubscribeSecret: "unsubscribe-secret",
    });

    expect(result).toEqual({ processed: 0, sent: 0, skipped: 0, failed: 0 });
    expect(provider.sent).toHaveLength(0);
  });
});
