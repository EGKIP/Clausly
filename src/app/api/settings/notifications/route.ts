import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserPlan } from "@/lib/billing/plan";
import {
  getPreferences,
  updatePreferences,
  type EmailNotificationPreferences,
} from "@/lib/db/notification-preferences";
import { createClient } from "@/lib/supabase/server";
import { validationIssues } from "@/lib/validation";

const patchSchema = z.object({
  email: z.boolean().optional(),
  reminders: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
}).strict();

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ preferences: defaultPreferences(), mockMode: true });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const preferences = await getPreferences(supabase as unknown as Parameters<typeof getPreferences>[0], user.id);
  const plan = await getUserPlan(supabase, user.id);
  return NextResponse.json({ preferences, plan, mockMode: false });
}

export async function PATCH(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid notification preferences.", issues: validationIssues(parsed.error) },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = await getUserPlan(supabase, user.id);
  if (plan !== "pro" && parsed.data.weeklyDigest === true) {
    return NextResponse.json(
      { error: "Weekly digest emails are available on Pro.", code: "PLAN_REQUIRED" },
      { status: 403 }
    );
  }

  const preferences = await updatePreferences(
    supabase as unknown as Parameters<typeof updatePreferences>[0],
    user.id,
    parsed.data
  );
  return NextResponse.json({ preferences, plan, mockMode: false });
}

function defaultPreferences(): EmailNotificationPreferences {
  return { email: true, reminders: true, weeklyDigest: true };
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
