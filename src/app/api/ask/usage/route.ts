import { NextResponse } from "next/server";
import { PLAN_LIMITS } from "@/lib/billing/limits";
import { getQaUsage } from "@/lib/billing/qa-rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({
      used: 0,
      limit: PLAN_LIMITS.free.qaPerDay,
      remaining: PLAN_LIMITS.free.qaPerDay,
      plan: "free",
      resetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await getQaUsage(supabase, user.id));
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
