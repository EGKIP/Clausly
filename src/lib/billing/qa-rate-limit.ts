import "server-only";

import { PLAN_LIMITS, type PlanName } from "./limits";
import { getUserPlan } from "./plan";

const QA_JOB_TYPES = ["qa_question", "qa_portfolio"] as const;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type UsageRow = {
  created_at: string;
};

type SupabaseLike = {
  from(table: string): {
    select(columns?: string, options?: { count?: string; head?: boolean }): any;
  };
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

export async function getQaUsage(supabase: SupabaseLike, userId: string): Promise<QaUsage> {
  const plan = await getUserPlan(supabase, userId);
  const limit = PLAN_LIMITS[plan].qaPerDay;
  const now = new Date();
  const windowStart = new Date(now.getTime() - DAY_IN_MS).toISOString();

  const { count, error: countError } = await supabase
    .from("usage_metrics")
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
  const { data: oldestRows } = await supabase
    .from("usage_metrics")
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

export async function canAskQuestion(supabase: SupabaseLike, userId: string): Promise<QaGate> {
  const usage = await getQaUsage(supabase, userId);
  return {
    ...usage,
    allowed: usage.remaining > 0,
  };
}
