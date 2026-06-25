import { NextResponse } from "next/server";
import { getPublicShareDigest } from "@/lib/db/share-digest";
import {
  createServiceSupabaseClient,
  hasServiceSupabaseEnv,
} from "@/lib/notifications/supabase-service";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  if (!hasServiceSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 503 });
  }

  const { token } = await context.params;
  const supabase = createServiceSupabaseClient();
  const digest = await getPublicShareDigest(supabase as unknown as Parameters<typeof getPublicShareDigest>[0], token);

  if (!digest) {
    return NextResponse.json({ error: "Share not found." }, { status: 404 });
  }

  return NextResponse.json(digest);
}
