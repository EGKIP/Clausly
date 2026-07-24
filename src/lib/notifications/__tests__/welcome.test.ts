import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailMessage, EmailProvider } from "../email-provider";
import { renderWelcomeEmail } from "../templates";
import { sendWelcomeEmailOnceForUser, type WelcomeEmailOptions } from "../welcome";
import {
  createServiceSupabaseClientMock,
  db,
  resetSupabaseMock,
  seedUser,
  userA,
} from "@/../tests/helpers/supabase";

vi.mock("server-only", () => ({}));

const sentMessages: EmailMessage[] = [];

class MockProvider implements EmailProvider {
  async send(message: EmailMessage) {
    sentMessages.push(message);
    return { id: `welcome-${sentMessages.length}` };
  }
}

describe("welcome email", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    sentMessages.length = 0;
  });

  it("sends once, records the marker, and uses the support reply-to address", async () => {
    seedUser(userA, {
      full_name: "Ada Lovelace",
      notification_preferences: { email: true, version: 2 },
    });

    const first = await sendWelcomeEmailOnceForUser({
      supabase: createServiceSupabaseClientMock() as unknown as WelcomeEmailOptions["supabase"],
      provider: new MockProvider(),
      userId: userA.id,
      baseUrl: "https://clausly.test",
      from: "Clausly <support@cloudly.app>",
      supportEmail: "support@cloudly.app",
      now: new Date("2026-07-24T12:00:00.000Z"),
    });
    const second = await sendWelcomeEmailOnceForUser({
      supabase: createServiceSupabaseClientMock() as unknown as WelcomeEmailOptions["supabase"],
      provider: new MockProvider(),
      userId: userA.id,
      baseUrl: "https://clausly.test",
    });

    expect(first).toEqual({ sent: true });
    expect(second).toEqual({ sent: false, skippedReason: "already_sent" });
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toMatchObject({
      to: userA.email,
      from: "Clausly <support@cloudly.app>",
      replyTo: "support@cloudly.app",
      subject: "Welcome to Clausly",
    });
    expect(sentMessages[0].html).toContain("We will not spam you.");
    expect(db().users[0].notification_preferences).toMatchObject({
      email: true,
      version: 2,
      welcome_email_sent_at: "2026-07-24T12:00:00.000Z",
    });
  });

  it("does not send when global email notifications are disabled", async () => {
    seedUser(userA, { notification_preferences: { email: false } });

    const result = await sendWelcomeEmailOnceForUser({
      supabase: createServiceSupabaseClientMock() as unknown as WelcomeEmailOptions["supabase"],
      provider: new MockProvider(),
      userId: userA.id,
    });

    expect(result).toEqual({ sent: false, skippedReason: "email_disabled" });
    expect(sentMessages).toHaveLength(0);
    expect(db().users[0].notification_preferences).toEqual({ email: false });
  });

  it("renders dashboard, preference, and support links in plain text", () => {
    const template = renderWelcomeEmail({
      userName: "Ada",
      dashboardUrl: "https://clausly.test/dashboard",
      preferencesUrl: "https://clausly.test/dashboard/settings",
      supportEmail: "support@cloudly.app",
    });

    expect(template.text).toContain("Open your dashboard: https://clausly.test/dashboard");
    expect(template.text).toContain("Manage notification preferences: https://clausly.test/dashboard/settings");
    expect(template.text).toContain("Support: support@cloudly.app");
  });
});
