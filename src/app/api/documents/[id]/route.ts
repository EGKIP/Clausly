import { NextResponse } from "next/server";
import { z } from "zod";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { auditRequestMetadata, recordAuditEvent } from "@/lib/audit/log";
import { toUiDocument } from "@/lib/db/adapters";
import { getDocumentDetail } from "@/lib/db/documents";
import { createClient } from "@/lib/supabase/server";
import { boundedTextSchema, validationIssues } from "@/lib/validation";

const documentPatchSchema = z.object({
  title: boundedTextSchema(1, 200),
}).strict();

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  if (!hasSupabaseEnv()) {
    const { id } = await context.params;
    const detail = await getDocumentDetail(id);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(detail);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const detail = await getDocumentDetail(id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(detail);
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = documentPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid document update.", issues: validationIssues(parsed.error) },
      { status: 400 }
    );
  }

  const { id } = await context.params;
  const { data, error } = await supabase
    .from("documents")
    .update({ title: parsed.data.title })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  try {
    await recordAuditEvent(supabase, {
      userId: user.id,
      action: AUDIT_ACTIONS.DOCUMENT_RENAMED,
      resourceType: "document",
      resourceId: id,
      metadata: { title: parsed.data.title, ...auditRequestMetadata(request) },
    });
  } catch {
    // Audit logging is best-effort; the rename itself is the source of truth.
  }

  return NextResponse.json({ document: toUiDocument(data) });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const { data: document, error: readError } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 404 });

  if (!document.storage_path.startsWith(`${user.id}/`)) {
    console.warn("Rejected document delete due to owner path mismatch.", {
      documentId: id,
      userId: user.id,
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: storageError } = await supabase.storage
    .from("documents")
    .remove([document.storage_path]);

  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });

  const { error: deleteError } = await supabase.from("documents").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  try {
    await recordAuditEvent(supabase, {
      userId: user.id,
      action: AUDIT_ACTIONS.DOCUMENT_DELETED,
      resourceType: "document",
      resourceId: id,
      metadata: auditRequestMetadata(request),
    });
  } catch {
    // Audit logging is best-effort; delete success remains the source of truth.
  }

  return NextResponse.json({ ok: true });
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
