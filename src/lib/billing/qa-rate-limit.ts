import "server-only";

import { PLAN_LIMITS, type PlanName } from "./limits";
import { getUserPlan } from "./plan";

const QA_JOB_TYPES = ["qa_question", "qa_portfolio"] as const;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type UsageRow = {
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
  in(column: string, value: unknown[]): QueryBuilder<T>;
  gte(column: string, value: unknown): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
};

type UsageMetricsTable = {
  select<T = unknown>(columns?: string, options?: { count?: string; head?: boolean }): QueryBuilder<T>;
};

export type QaUsage = {
  used: number;
  limit: number;
  remaining: number;
  plan: PlanName;
  resetsAt: string;
};

export type QaGate = QaUsage & {
  allowed: boolean;
};

export async function getQaUsage(supabase: unknown, userId: string): Promise<QaUsage> {
  const plan = await getUserPlan(supabase as Parameters<typeof getUserPlan>[0], userId);
  const limit = PLAN_LIMITS[plan].qaPerDay;
  const now = new Date();
  const windowStart = new Date(now.getTime() - DAY_IN_MS).toISOString();
  const usageMetrics = (supabase as { from(table: "usage_metrics"): UsageMetricsTable }).from("usage_metrics");

  const { count, error: countError } = await usageMetrics
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("job_type", [...QA_JOB_TYPES])
    .gte("created_at", windowStart);

  if (countError) {
    return {
      used: 0,
      limit,
      remaining: limit,
      plan,
      resetsAt: new Date(now.getTime() + DAY_IN_MS).toISOString(),
    };
  }

  const used = count ?? 0;
  const { data: oldestRows } = await usageMetrics
    .select("created_at")
    .eq("user_id", userId)
    .in("job_type", [...QA_JOB_TYPES])
    .gte("created_at", windowStart)
    .order("created_at", { ascending: true })
    .limit(1);

  const oldestCreatedAt = Array.isArray(oldestRows) ? (oldestRows[0] as UsageRow | undefined)?.created_at : null;
  const resetsAt = oldestCreatedAt
    ? new Date(new Date(oldestCreatedAt).getTime() + DAY_IN_MS).toISOString()
    : new Date(now.getTime() + DAY_IN_MS).toISOString();

  return {
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    plan,
    resetsAt,
  };
}

export async function canAskQuestion(supabase: unknown, userId: string): Promise<QaGate> {
  const usage = await getQaUsage(supabase, userId);
  return {
    ...usage,
    allowed: usage.remaining > 0,
  };
}
