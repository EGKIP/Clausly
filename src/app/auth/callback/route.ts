import { after, NextResponse } from "next/server";
import { sendWelcomeEmailOnceForUser } from "@/lib/notifications/welcome";
import { createClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  let authenticatedUserId: string | null = null;

  if (code && hasSupabaseEnv()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        scheduleWelcomeEmail(user.id);
        return NextResponse.redirect(new URL(next, requestUrl.origin));
      }

      console.warn("OAuth callback code exchange failed", {
        message: error.message,
      });

      const loginUrl = new URL("/login", requestUrl.origin);
      loginUrl.searchParams.set("error", "oauth_callback_failed");
      return NextResponse.redirect(loginUrl);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    authenticatedUserId = user?.id ?? null;
  }

  if (authenticatedUserId) scheduleWelcomeEmail(authenticatedUserId);
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function hasServiceSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function scheduleWelcomeEmail(userId: string) {
  if (!hasServiceSupabaseEnv()) return;

  after(async () => {
    try {
      await sendWelcomeEmailOnceForUser({
        supabase: createServiceSupabaseClient(),
        userId,
      });
    } catch (error) {
      console.warn("Welcome email could not be sent.", {
        userId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}

function safeNextPath(next: string | null) {
  if (!next?.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}
