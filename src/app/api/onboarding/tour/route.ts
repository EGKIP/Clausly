import { NextResponse } from "next/server";
import { getTourState, markTourComplete } from "@/lib/db/onboarding-tour";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ completedAt: null });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const state = await getTourState(supabase, user.id);
    return NextResponse.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load onboarding tour state.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ completedAt: null, skipped: true });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const state = await markTourComplete(supabase, user.id);
    return NextResponse.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not complete onboarding tour.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
