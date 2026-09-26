import "server-only";

import { PLAN_LIMITS, type PlanName } from "./limits";

type SupabaseLike = {
  from: (table: "users" | "documents") => {
    select: (columns?: string, options?: { count?: string; head?: boolean }) => unknown;
  };
};

type PlanQuery = {
  eq: (column: string, value: unknown) => PlanQuery;
  single: () => Promise<{ data: { subscription_tier?: unknown } | null; error: { message?: string } | null }>;
};

type CountQuery = {
  eq: (column: string, value: unknown) => Promise<{ count: number | null; error: { message?: string } | null }>;
};

export async function getUserPlan(supabase: SupabaseLike, userId: string): Promise<PlanName> {
  try {
    const query = supabase
      .from("users")
      .select("subscription_tier") as PlanQuery;
    const { data, error } = await query.eq("id", userId).single();
    if (error) return "free";
    return normalizePlan(data?.subscription_tier);
  } catch {
    return "free";
  }
}

export async function canUploadDocument(supabase: SupabaseLike, userId: string) {
  const plan = await getUserPlan(supabase, userId);
  const limit = PLAN_LIMITS[plan].maxDocuments;
  const { count, error } = await countUserDocuments(supabase, userId);
  // A failed count must never read as "0 documents" — that would silently
  // lift the plan limit for anyone hitting a transient DB error. Fail
  // closed (deny the upload) and report the count as if already at limit.
  const current = error ? limit : count;
  return {
    allowed: !error && current < limit,
    current,
    limit,
    plan,
  };
}

export async function canAccessInsights(supabase: SupabaseLike, userId: string) {
  const plan = await getUserPlan(supabase, userId);
  return {
    allowed: PLAN_LIMITS[plan].hasInsights,
    plan,
  };
}

async function countUserDocuments(supabase: SupabaseLike, userId: string): Promise<{ count: number; error: boolean }> {
  try {
    const query = supabase
      .from("documents")
      .select("id", { count: "exact", head: true }) as CountQuery;
    const { count, error } = await query.eq("user_id", userId);
    if (error) return { count: 0, error: true };
    return { count: count ?? 0, error: false };
  } catch {
    return { count: 0, error: true };
  }
}

function normalizePlan(value: unknown): PlanName {
  return value === "pro" ? "pro" : "free";
}
