import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
}).strict();

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({
      displayName: "Demo User",
      email: "demo@clausly.app",
      mockMode: true,
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("users")
    .select("full_name,email")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    displayName: data.full_name ?? user.email?.split("@")[0] ?? "Clausly user",
    email: data.email,
    mockMode: false,
  });
}

export async function PATCH(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const parsed = profileSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid profile update.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("users")
    .update({ full_name: parsed.data.displayName })
    .eq("id", user.id)
    .select("full_name,email")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    displayName: data.full_name ?? parsed.data.displayName,
    email: data.email,
    mockMode: false,
  });
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
