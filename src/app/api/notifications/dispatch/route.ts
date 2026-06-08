import { NextResponse } from "next/server";
import { dispatchDueReminderEmails, hasServiceSupabaseEnv, hasSupabaseEnv } from "@/lib/notifications/dispatch";

export async function POST(request: Request) {
  const secret = process.env.CLAUSLY_DISPATCH_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  if (!hasServiceSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 503 });
  }

  const result = await dispatchDueReminderEmails();
  return NextResponse.json(result);
}
