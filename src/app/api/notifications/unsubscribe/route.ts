import { NextResponse } from "next/server";
import { hasServiceSupabaseEnv, hasSupabaseEnv, unsubscribeUserEmail } from "@/lib/notifications/dispatch";

export async function GET(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  if (!hasServiceSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  const token = url.searchParams.get("token");

  if (!userId || !token) {
    return NextResponse.json({ error: "Missing unsubscribe parameters." }, { status: 400 });
  }

  const result = await unsubscribeUserEmail({ userId, token });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
