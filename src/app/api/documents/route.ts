import { NextResponse } from "next/server";
import { toUiDocument } from "@/lib/db/adapters";
import { createClient } from "@/lib/supabase/server";
import { documents as mockDocuments } from "@/lib/mock-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("empty") === "1") {
    return NextResponse.json({ documents: [] });
  }
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ documents: mockDocuments });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ documents: (data ?? []).map(toUiDocument) });
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
