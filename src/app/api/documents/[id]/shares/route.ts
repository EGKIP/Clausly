import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserPlan } from "@/lib/billing/plan";
import { createShare, listShares } from "@/lib/db/shares";
import { createClient } from "@/lib/supabase/server";
import { validationIssues } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};
type ShareClient = Parameters<typeof createShare>[0];

const createShareSchema = z.object({
  expiresInDays: z.number().int().positive().max(365).nullable().optional(),
}).strict();

export async function GET(_request: Request, context: RouteContext) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const document = await findOwnedDocument(supabase, id, user.id);
  if (document.error) return document.error;

  const shares = await listShares(supabase as unknown as ShareClient, id, user.id);
  return NextResponse.json({ shares });
}

export async function POST(request: Request, context: RouteContext) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = await getUserPlan(supabase, user.id);
  if (plan !== "pro") {
    return NextResponse.json(
      {
        error: "Share links are available on Pro.",
        code: "PLAN_REQUIRED",
        plan,
      },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const document = await findOwnedDocument(supabase, id, user.id);
  if (document.error) return document.error;

  const parsed = createShareSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid share settings.", issues: validationIssues(parsed.error) },
      { status: 400 }
    );
  }

  const share = await createShare(supabase as unknown as ShareClient, {
    documentId: id,
    userId: user.id,
    expiresInDays: parsed.data.expiresInDays,
  });
  const url = new URL(`/share/${share.token}`, publicBaseUrl(request)).toString();

  return NextResponse.json(
    {
      id: share.id,
      token: share.token,
      url,
      expiresAt: share.expiresAt,
    },
    { status: 201 }
  );
}

async function findOwnedDocument(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single() as { data: { id: string } | null; error: { code?: string; message: string } | null };

  if (error?.code === "PGRST116" || !data) {
    return { data: null, error: NextResponse.json({ error: "Document not found." }, { status: 404 }) };
  }
  if (error) {
    return { data: null, error: NextResponse.json({ error: error.message }, { status: 500 }) };
  }
  return { data, error: null };
}

function publicBaseUrl(request: Request) {
  return process.env.NEXT_PUBLIC_BASE_URL ?? new URL(request.url).origin;
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
