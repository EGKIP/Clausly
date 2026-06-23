import { NextResponse } from "next/server";
import { hasServiceSupabaseEnv, hasSupabaseEnv } from "@/lib/notifications/dispatch";
import { sendWeeklyDigests } from "@/lib/notifications/weekly-digest";

async function handle(request: Request) {
  const dispatchSecret = process.env.CLAUSLY_DISPATCH_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  const expected = [dispatchSecret, cronSecret].filter((value): value is string => Boolean(value));
  if (expected.length === 0 || !expected.some((secret) => authorization === `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  if (!hasServiceSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 503 });
  }

  const result = await sendWeeklyDigests();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
