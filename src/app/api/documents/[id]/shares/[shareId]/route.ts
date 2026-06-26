import { NextResponse } from "next/server";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { auditRequestMetadata, recordAuditEvent } from "@/lib/audit/log";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string; shareId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, shareId } = await context.params;
  const { data, error } = await supabase
    .from("document_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId)
    .eq("document_id", id)
    .eq("user_id", user.id)
    .select("id")
    .single() as { data: { id: string } | null; error: { code?: string; message: string } | null };

  if (error?.code === "PGRST116" || !data) {
    return NextResponse.json({ error: "Share not found." }, { status: 404 });
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await recordAuditEvent(supabase, {
      userId: user.id,
      action: AUDIT_ACTIONS.SHARE_REVOKED,
      resourceType: "document_share",
      resourceId: shareId,
      metadata: {
        documentId: id,
        ...auditRequestMetadata(request),
      },
    });
  } catch {
    // Audit logging is best-effort; share revocation remains the source of truth.
  }

  return NextResponse.json({ ok: true });
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
