import { NextResponse } from "next/server";
import { reindexDocumentChunksFromStorage } from "@/lib/ai/embeddings";
import {
  createServiceSupabaseClient,
  hasServiceSupabaseEnv,
  hasSupabaseEnv,
} from "@/lib/notifications/supabase-service";

type BackfillDocument = {
  id: string;
  user_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
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
    .select("id, user_id, storage_path, file_name, mime_type")
    .eq("status", "ready");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let processed = 0;
  let failed = 0;

  for (const document of (documents ?? []) as BackfillDocument[]) {
    // One document's failure (chunk lookup, download, extraction, embedding)
    // must not abort the rest of the backfill.
    try {
      if (await documentHasChunks(supabase, document.id)) continue;

      // Shared with Ask's recovery path: picks the extractor by the stored
      // mime type, so DOCX/TXT/image documents aren't parsed as PDFs.
      const result = await reindexDocumentChunksFromStorage(supabase, document);
      if (result.error) throw new Error(result.error);
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
