import "server-only";

import type { PlanName } from "@/lib/billing/limits";
import { getUserPlan } from "@/lib/billing/plan";

const FREE_EXPORT_LIMIT = 5;
const EXPORT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type ExportRow = {
  created_at: string;
};

type SupabaseError = {
  message: string;
  code?: string;
};

type QueryResult<T = unknown> = {
  data: T | null;
  error: SupabaseError | null;
  count: number | null;
};

type QueryBuilder<T = unknown> = PromiseLike<QueryResult<T>> & {
  eq(column: string, value: unknown): QueryBuilder<T>;
  gte(column: string, value: unknown): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
};

type DocumentExportsTable = {
  select<T = unknown>(columns?: string, options?: { count?: string; head?: boolean }): QueryBuilder<T>;
};

export type ExportUsage = {
  used: number;
  limit: number;
  remaining: number;
  plan: PlanName;
  resetsAt: string;
};

export type ExportGate = ExportUsage & {
  allowed: boolean;
};

export async function getExportUsage(supabase: unknown, userId: string): Promise<ExportUsage> {
  const plan = await getUserPlan(supabase as Parameters<typeof getUserPlan>[0], userId);
  const limit = plan === "pro" ? Infinity : FREE_EXPORT_LIMIT;
  const now = new Date();
  const windowStart = new Date(now.getTime() - EXPORT_WINDOW_MS).toISOString();

  if (plan === "pro") {
    return {
      used: 0,
      limit,
      remaining: Infinity,
      plan,
      resetsAt: new Date(now.getTime() + EXPORT_WINDOW_MS).toISOString(),
    };
  }

  const exportsTable = (supabase as { from(table: "document_exports"): DocumentExportsTable }).from("document_exports");
  const { count, error: countError } = await exportsTable
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", windowStart);

  if (countError) {
    return {
      used: 0,
      limit,
      remaining: limit,
      plan,
      resetsAt: new Date(now.getTime() + EXPORT_WINDOW_MS).toISOString(),
    };
  }

  const used = count ?? 0;
  const { data: oldestRows } = await exportsTable
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: true })
    .limit(1);

  const oldestCreatedAt = Array.isArray(oldestRows) ? (oldestRows[0] as ExportRow | undefined)?.created_at : null;
  const resetsAt = oldestCreatedAt
    ? new Date(new Date(oldestCreatedAt).getTime() + EXPORT_WINDOW_MS).toISOString()
    : new Date(now.getTime() + EXPORT_WINDOW_MS).toISOString();

  return {
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    plan,
    resetsAt,
  };
}

export async function canExport(supabase: unknown, userId: string): Promise<ExportGate> {
  const usage = await getExportUsage(supabase, userId);
  return {
    ...usage,
    allowed: usage.remaining > 0,
  };
}
