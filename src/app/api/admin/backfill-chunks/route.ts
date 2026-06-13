import { NextResponse } from "next/server";
import { embedDocumentChunks } from "@/lib/ai/embeddings";
import { extractPdfTextWithOcr } from "@/lib/ai/pdf-text";
import {
  createServiceSupabaseClient,
  hasServiceSupabaseEnv,
  hasSupabaseEnv,
} from "@/lib/notifications/supabase-service";

type BackfillDocument = {
  id: string;
  user_id: string;
  storage_path: string;
};

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }
  if (!hasServiceSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 503 });
  }

  const adminSecret = process.env.CLAUSLY_ADMIN_SECRET;
  const authorization = request.headers.get("authorization");
  if (!adminSecret || authorization !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();
  const { data: documents, error } = await supabase
    .from("documents")
    .select("id, user_id, storage_path")
    .eq("status", "ready");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let processed = 0;
  let failed = 0;

  for (const document of (documents ?? []) as BackfillDocument[]) {
    const hasChunks = await documentHasChunks(supabase, document.id);
    if (hasChunks) continue;

    try {
      const { data: file, error: downloadError } = await supabase.storage
        .from("documents")
        .download(document.storage_path);
      if (downloadError) throw new Error(downloadError.message);
      if (!file) throw new Error("Document file could not be downloaded.");

      const text = await extractPdfTextWithOcr(file);
      const result = await embedDocumentChunks(supabase, document.id, document.user_id, text);
      processed += result.indexed > 0 ? 1 : 0;
    } catch (backfillError) {
      failed += 1;
      console.warn("Document chunk backfill failed.", {
        documentId: document.id,
        message: backfillError instanceof Error ? backfillError.message : "Unknown backfill error.",
      });
    }
  }

  return NextResponse.json({ processed, failed });
}

async function documentHasChunks(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  documentId: string,
) {
  const { count, error } = await supabase
    .from("document_chunks")
    .select("id", { count: "exact", head: true })
    .eq("document_id", documentId);

  if (error) throw new Error(error.message);
  return Boolean(count && count > 0);
}
