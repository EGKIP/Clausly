import { NextResponse } from "next/server";
import { z } from "zod";
import { listConversations } from "@/lib/db/conversations";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  documentId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
}).strict();

export async function GET(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ conversations: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    documentId: url.searchParams.get("documentId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid conversation query.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const conversations = await listConversations(
    supabase,
    user.id,
    parsed.data.documentId ?? undefined,
    parsed.data.limit
  );

  return NextResponse.json({ conversations });
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
