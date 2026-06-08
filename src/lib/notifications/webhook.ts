import "server-only";

import { Webhook, WebhookVerificationError } from "svix";
import type { Json } from "@/lib/supabase/types";
import { createServiceSupabaseClient, type ServiceSupabaseClient } from "./supabase-service";
import { notificationPreferenceVersion } from "./templates";

const EMAIL_WEBHOOK_JOB_TYPE = "email_webhook";
const RESEND_PROVIDER = "resend";
const NIL_USER_ID = "00000000-0000-0000-0000-000000000000";

export type ResendWebhookType =
  | "email.delivered"
  | "email.bounced"
  | "email.complained"
  | "email.delivery_delayed"
  | "email.opened"
  | "email.clicked";

export type ResendWebhookHeaders = {
  "svix-id": string | null;
  "svix-timestamp": string | null;
  "svix-signature": string | null;
};

export type HandleResendWebhookOptions = {
  supabase?: ServiceSupabaseClient;
  secret?: string;
};

export type WebhookResult = {
  ok: true;
  duplicate: boolean;
  eventId: string;
  type: ResendWebhookType;
};

type ResendWebhookPayload = {
  id?: unknown;
  type?: unknown;
  created_at?: unknown;
  data?: {
    to?: unknown;
    email_id?: unknown;
    tags?: unknown;
    bounce?: {
      type?: unknown;
    };
  };
};

type UserRow = {
  id: string;
  email?: string | null;
  notification_preferences?: Json;
};

export function verifyResendWebhookPayload(
  payload: string,
  headers: ResendWebhookHeaders,
  secret = process.env.RESEND_WEBHOOK_SECRET,
) {
  if (!secret) {
    throw new Error("Missing RESEND_WEBHOOK_SECRET.");
  }

  if (!headers["svix-id"] || !headers["svix-timestamp"] || !headers["svix-signature"]) {
    throw new WebhookVerificationError("Missing Svix signature headers.");
  }

  return new Webhook(secret).verify(payload, {
    "svix-id": headers["svix-id"],
    "svix-timestamp": headers["svix-timestamp"],
    "svix-signature": headers["svix-signature"],
  }) as ResendWebhookPayload;
}

export async function handleResendWebhook(
  rawPayload: string,
  headers: ResendWebhookHeaders,
  options: HandleResendWebhookOptions = {},
): Promise<WebhookResult> {
  const event = verifyResendWebhookPayload(rawPayload, headers, options.secret);
  return processVerifiedResendWebhook(event, headers["svix-id"], options);
}

export async function processVerifiedResendWebhook(
  event: ResendWebhookPayload,
  headerEventId: string | null,
  options: HandleResendWebhookOptions = {},
): Promise<WebhookResult> {
  const type = parseWebhookType(event.type);
  const eventId = parseEventId(event.id, headerEventId);
  const supabase = options.supabase ?? createServiceSupabaseClient();

  const duplicate = await hasProcessedEvent(supabase, eventId);
  if (duplicate) {
    return { ok: true, duplicate: true, eventId, type };
  }

  const recipientEmail = firstEmail(event.data?.to);
  const taggedUserId = stringTag(event.data?.tags, "user_id");
  const user = taggedUserId
    ? await findUserById(supabase, taggedUserId)
    : recipientEmail
      ? await findUserByEmail(supabase, recipientEmail)
      : null;

  const shouldDisableEmail = type === "email.complained" || (type === "email.bounced" && bounceType(event) === "hard");
  if (shouldDisableEmail && user) {
    await disableUserEmail(supabase, user);
  }

  await logWebhookEvent(supabase, {
    eventId,
    userId: user?.id ?? taggedUserId ?? NIL_USER_ID,
    status: statusForEvent(type),
    errorMessage: errorMessageForEvent(type, event),
  });

  return { ok: true, duplicate: false, eventId, type };
}

function parseWebhookType(type: unknown): ResendWebhookType {
  if (
    type === "email.delivered" ||
    type === "email.bounced" ||
    type === "email.complained" ||
    type === "email.delivery_delayed" ||
    type === "email.opened" ||
    type === "email.clicked"
  ) {
    return type;
  }

  throw new Error("Unsupported Resend webhook event type.");
}

function parseEventId(payloadId: unknown, headerId: string | null) {
  if (typeof payloadId === "string" && payloadId.trim().length > 0) return payloadId;
  if (headerId && headerId.trim().length > 0) return headerId;
  throw new Error("Missing Resend webhook event id.");
}

async function hasProcessedEvent(supabase: ServiceSupabaseClient, eventId: string) {
  const { data, error } = await supabase
    .from("usage_metrics")
    .select("id")
    .eq("job_type", EMAIL_WEBHOOK_JOB_TYPE)
    .eq("provider", RESEND_PROVIDER)
    .eq("model", eventId)
    .limit(1);

  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length > 0;
}

async function findUserById(supabase: ServiceSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("id,email,notification_preferences")
    .eq("id", userId)
    .single();

  if (error) return null;
  return data as UserRow | null;
}

async function findUserByEmail(supabase: ServiceSupabaseClient, email: string) {
  const { data, error } = await supabase
    .from("users")
    .select("id,email,notification_preferences")
    .eq("email", email)
    .single();

  if (error) return null;
  return data as UserRow | null;
}

async function disableUserEmail(supabase: ServiceSupabaseClient, user: UserRow) {
  const preferences = objectPreferences(user.notification_preferences);
  const { error } = await supabase
    .from("users")
    .update({
      notification_preferences: {
        ...preferences,
        email: false,
        version: nextPreferenceVersion(user.notification_preferences),
      },
    })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
}

async function logWebhookEvent(
  supabase: ServiceSupabaseClient,
  input: {
    eventId: string;
    userId: string;
    status: "completed" | "failed";
    errorMessage: string | null;
  },
) {
  const { error } = await supabase.from("usage_metrics").insert({
    user_id: input.userId,
    job_type: EMAIL_WEBHOOK_JOB_TYPE,
    provider: RESEND_PROVIDER,
    model: input.eventId,
    input_token_count: 0,
    output_token_count: 0,
    status: input.status,
    error_message: input.errorMessage,
  });

  if (error) throw new Error(error.message);
}

function statusForEvent(type: ResendWebhookType) {
  return type === "email.bounced" || type === "email.complained" ? "failed" : "completed";
}

function errorMessageForEvent(type: ResendWebhookType, event: ResendWebhookPayload) {
  if (type === "email.bounced") return `Resend bounce${bounceType(event) ? `: ${bounceType(event)}` : ""}.`;
  if (type === "email.complained") return "Resend complaint.";
  return null;
}

function bounceType(event: ResendWebhookPayload) {
  const type = event.data?.bounce?.type;
  return typeof type === "string" ? type : null;
}

function firstEmail(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" && candidate.includes("@") ? candidate.toLowerCase() : null;
}

function stringTag(tags: unknown, key: string) {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return null;
  const value = (tags as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function objectPreferences(preferences: unknown): Record<string, Json> {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
    return {};
  }

  return preferences as Record<string, Json>;
}

function nextPreferenceVersion(preferences: unknown): Json {
  const current = notificationPreferenceVersion(preferences);
  if (typeof current === "number") return current + 1;
  if (typeof current === "string") {
    const numeric = Number(current);
    if (Number.isFinite(numeric)) return String(numeric + 1);
  }

  return 2;
}
