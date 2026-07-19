import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { chunkDocumentText } from "../chunking";
import { getEmbeddingProvider, getEmbeddingProviderName, type EmbeddingProvider } from "./provider";

type AnyClient = SupabaseClient<Database>;

const BATCH_SIZE = 100;

type EmbedOptions = {
  provider?: EmbeddingProvider;
};

export type EmbedResult = {
  indexed: number;
  error?: string;
};

export async function embedDocumentChunks(
  supabase: AnyClient,
  documentId: string,
  userId: string,
  fullText: string,
  options: EmbedOptions = {},
): Promise<EmbedResult> {
  warnIfMockEmbeddingsInProduction();

  try {
    const chunks = chunkDocumentText(fullText);
    const { error: deleteError } = await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", documentId)
      .eq("user_id", userId);

    if (deleteError) throw new Error(deleteError.message);
    if (chunks.length === 0) return { indexed: 0, error: "Document produced no indexable text." };

    const provider = options.provider ?? getEmbeddingProvider();
    const embeddings: number[][] = [];

    for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
      const batch = chunks.slice(start, start + BATCH_SIZE);
      embeddings.push(...await provider(batch.map((chunk) => chunk.content)));
    }

    if (embeddings.length !== chunks.length) {
      throw new Error("Embedding provider returned the wrong number of vectors.");
    }

    const { error: insertError } = await supabase.from("document_chunks").insert(
      chunks.map((chunk, index) => ({
        document_id: documentId,
        user_id: userId,
        chunk_index: chunk.index,
        content: chunk.content,
        page_number: chunk.pageNumber ?? null,
        embedding: embeddings[index],
      })),
    );

    if (insertError) throw new Error(insertError.message);

    return { indexed: chunks.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown indexing error.";
    console.error("Document chunk indexing failed.", {
      documentId,
      provider: getEmbeddingProviderName(),
      message,
    });
    return { indexed: 0, error: message };
  }
}

/**
 * Recovery path for a document whose analysis succeeded but whose chunks are
 * missing (e.g. the original embedding pass failed silently, or the document
 * predates chunk indexing). Downloads the stored PDF, re-extracts its text,
 * and rebuilds document_chunks. Callers must have verified ownership.
 */
export async function reindexDocumentChunksFromStorage(
  supabase: AnyClient,
  document: { id: string; user_id: string; storage_path: string },
): Promise<EmbedResult> {
  try {
    const { data: file, error: downloadError } = await supabase.storage
      .from("documents")
      .download(document.storage_path);
    if (downloadError) throw new Error(downloadError.message);
    if (!file) throw new Error("Document file could not be downloaded.");

    // Dynamic import keeps the native-canvas-backed PDF stack out of routes
    // that only need reindexing on the rare recovery path.
    const { extractPdfTextWithOcr } = await import("../pdf-text");
    const text = await extractPdfTextWithOcr(file);
    return await embedDocumentChunks(supabase, document.id, document.user_id, text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown reindexing error.";
    console.error("Document chunk reindex failed.", { documentId: document.id, message });
    return { indexed: 0, error: message };
  }
}

let warnedMockInProduction = false;

function warnIfMockEmbeddingsInProduction() {
  if (warnedMockInProduction) return;
  const isProduction = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
  if (isProduction && getEmbeddingProviderName() === "mock") {
    warnedMockInProduction = true;
    console.warn(
      "Mock embedding provider is active in production. Set CLAUSLY_EMBEDDING_PROVIDER=openai (with OPENAI_API_KEY) for real retrieval quality.",
    );
  }
}
