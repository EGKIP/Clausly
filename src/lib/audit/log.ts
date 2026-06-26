import "server-only";

import type { Json } from "@/lib/supabase/types";
import type { AuditAction } from "./actions";

const MAX_METADATA_BYTES = 1900;
const sensitiveKeys = new Set(["password", "token", "secret", "key"]);

type AuditSupabaseClient = {
  from: (table: "audit_events") => {
    insert: (payload: {
      user_id: string;
      action: AuditAction;
      resource_type: string;
      resource_id: string | null;
      metadata: Json;
    }) => PromiseLike<{ error: { message: string } | null }>;
  };
};

type AuditEventInput = {
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  metadata?: unknown;
};

/**
 * Best-effort audit writer for user-owned state changes. Canonical actions are
 * defined in AUDIT_ACTIONS and intentionally use a small dotted vocabulary.
 * Sensitive metadata keys are stripped, metadata is capped below 2KB, and
 * logging failures are swallowed so audit writes never break the source action.
 */
export async function logAuditEvent(
  supabase: AuditSupabaseClient,
  input: AuditEventInput
): Promise<void> {
  if (!hasSupabaseEnv()) return;

  try {
    const { error } = await supabase.from("audit_events").insert({
      user_id: input.userId,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId ?? null,
      metadata: sanitizeMetadata(input.metadata),
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.warn("Audit event insert failed.", {
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      message: error instanceof Error ? error.message : "Unknown audit error.",
    });
  }
}

export function sanitizeMetadata(value: unknown): Json {
  const sanitized = sanitizePlainObject(value);
  const serialized = JSON.stringify(sanitized);
  if (serialized.length <= MAX_METADATA_BYTES) return sanitized as Json;

  return {
    truncated: true,
    originalSize: serialized.length,
  };
}

function sanitizePlainObject(value: unknown): Record<string, Json> {
  if (!isPlainObject(value)) return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => {
      if (sensitiveKeys.has(key.toLowerCase())) return [];
      return [[key, sanitizeValue(item)]];
    })
  );
}

function sanitizeValue(value: unknown): Json {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (isPlainObject(value)) return sanitizePlainObject(value);
  return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
