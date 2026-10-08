import "server-only";

import type { Json } from "@/lib/supabase/types";
import { createEmailProvider, type EmailProvider } from "./email-provider";
import type { ServiceSupabaseClient } from "./supabase-service";
import { getDefaultFromEmail, getSupportEmail } from "./support";
import { renderWelcomeEmail } from "./templates";

type WelcomeUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  notification_preferences: Json;
};

export type WelcomeEmailResult = {
  sent: boolean;
  skippedReason?: "missing_user" | "missing_email" | "email_disabled" | "already_sent";
};

export type WelcomeEmailOptions = {
  supabase: ServiceSupabaseClient;
  provider?: EmailProvider;
  userId: string;
  now?: Date;
  baseUrl?: string;
  from?: string;
  supportEmail?: string;
};

const WELCOME_SENT_KEY = "welcome_email_sent_at";

export async function sendWelcomeEmailOnceForUser(options: WelcomeEmailOptions): Promise<WelcomeEmailResult> {
  const { data: user, error } = await options.supabase
    .from("users")
    .select("id,email,full_name,notification_preferences")
    .eq("id", options.userId)
    .single();

  if (error || !user) return { sent: false, skippedReason: "missing_user" };

  const typedUser = user as WelcomeUserRow;
  const preferences = objectPreferences(typedUser.notification_preferences);
  if (!typedUser.email) return { sent: false, skippedReason: "missing_email" };
  if (preferences.email === false) return { sent: false, skippedReason: "email_disabled" };
  if (typeof preferences[WELCOME_SENT_KEY] === "string") return { sent: false, skippedReason: "already_sent" };

  const provider = options.provider ?? createEmailProvider();
  const supportEmail = options.supportEmail ?? getSupportEmail();
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000");
  const template = renderWelcomeEmail({
    userName: typedUser.full_name || typedUser.email.split("@")[0] || "there",
    dashboardUrl: `${baseUrl}/dashboard`,
    preferencesUrl: `${baseUrl}/dashboard/settings`,
    supportEmail,
  });

  await provider.send({
    to: typedUser.email,
    from: options.from ?? getDefaultFromEmail(),
    replyTo: supportEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  const nextPreferences = {
    ...preferences,
    [WELCOME_SENT_KEY]: (options.now ?? new Date()).toISOString(),
  };
  const { error: updateError } = await options.supabase
    .from("users")
    .update({ notification_preferences: nextPreferences })
    .eq("id", options.userId);

  if (updateError) throw new Error(updateError.message);
  return { sent: true };
}

function objectPreferences(preferences: unknown): Record<string, Json> {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
    return {};
  }

  return preferences as Record<string, Json>;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
