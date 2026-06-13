import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { chunkDocumentText } from "../chunking";
import { getEmbeddingProvider, type EmbeddingProvider } from "./provider";

type AnyClient = SupabaseClient<Database>;

const BATCH_SIZE = 100;

type EmbedOptions = {
  provider?: EmbeddingProvider;
};

export async function embedDocumentChunks(
  supabase: AnyClient,
  documentId: string,
  userId: string,
  fullText: string,
  options: EmbedOptions = {},
): Promise<{ indexed: number }> {
  try {
    const chunks = chunkDocumentText(fullText);
    const { error: deleteError } = await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", documentId)
      .eq("user_id", userId);

    if (deleteError) throw new Error(deleteError.message);
    if (chunks.length === 0) return { indexed: 0 };

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
    console.warn("Document chunk indexing failed.", {
      documentId,
      message: error instanceof Error ? error.message : "Unknown indexing error.",
    });
    return { indexed: 0 };
  }
}
