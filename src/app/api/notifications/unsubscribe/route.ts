import { NextResponse } from "next/server";
import { hasServiceSupabaseEnv, hasSupabaseEnv, unsubscribeUserEmail } from "@/lib/notifications/dispatch";

// People reach this route by clicking a link in an email, so it redirects to a
// readable page instead of returning JSON. Outcomes are deliberately coarse:
// an unknown user and a bad token both read as "invalid" so the link cannot be
// used to probe which user ids exist, and database error text never leaves
// the server.
type UnsubscribeOutcome = "done" | "invalid" | "error";

function redirectTo(request: Request, status: UnsubscribeOutcome, type: string | null) {
  const target = new URL("/unsubscribed", request.url);
  target.searchParams.set("status", status);
  if (type === "weekly_digest") target.searchParams.set("type", "weekly_digest");
  return NextResponse.redirect(target, 303);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  const token = url.searchParams.get("token");
  const type = url.searchParams.get("type");

  if (!hasSupabaseEnv() || !hasServiceSupabaseEnv()) {
    console.error("[unsubscribe] Supabase is not configured.");
    return redirectTo(request, "error", type);
  }

  if (!userId || !token) {
    return redirectTo(request, "invalid", type);
  }

  try {
    const result = await unsubscribeUserEmail({ userId, token, type });
    if (result.ok) return redirectTo(request, "done", type);
    if (result.status === 400 || result.status === 404) return redirectTo(request, "invalid", type);
    console.error("[unsubscribe] preference update failed:", result.error);
    return redirectTo(request, "error", type);
  } catch (error) {
    console.error("[unsubscribe] failed:", error instanceof Error ? error.message : "unknown error");
    return redirectTo(request, "error", type);
  }
}
