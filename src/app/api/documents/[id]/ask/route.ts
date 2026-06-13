import { NextResponse } from "next/server";
import { z } from "zod";
import { getEmbeddingModel, getEmbeddingProvider, getEmbeddingProviderName } from "@/lib/ai/embeddings/provider";
import { getQAModel, getQAProvider, getQAProviderName } from "@/lib/ai/qa/provider";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const questionSchema = z.object({
  question: z.string().trim().min(3).max(500),
}).strict();

type MatchChunk = {
  id: string;
  content: string;
  page_number: number | null;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!hasSupabaseEnv()) {
    return NextResponse.json({
      answer: "Ask Clausly is running in demo mode. Connect Supabase to answer from indexed document text.",
      citations: [
        {
          chunkId: "demo-chunk",
          pageNumber: 1,
          snippet: "Demo citation excerpt from this contract.",
        },
      ],
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid question.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id, user_id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (documentError?.code === "PGRST116") {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 });
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  if (document.status !== "ready") {
    return NextResponse.json(
      { error: "Document is not ready yet.", code: "DOC_NOT_READY" },
      { status: 409 }
    );
  }

  const [questionEmbedding] = await getEmbeddingProvider()([parsed.data.question]);
  const { data: matches, error: matchError } = await supabase.rpc("match_document_chunks", {
    target_document_id: document.id,
    query_embedding: questionEmbedding,
    match_count: 5,
  });

  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 });

  const chunks = ((matches ?? []) as MatchChunk[]).map((chunk) => ({
    id: chunk.id,
    content: chunk.content,
    pageNumber: chunk.page_number,
  }));

  if (chunks.length === 0) {
    return NextResponse.json(
      { error: "Document text is still being indexed, try again shortly.", code: "DOC_NOT_INDEXED" },
      { status: 409 }
    );
  }

  const qaResult = await getQAProvider()({
    question: parsed.data.question,
    chunks,
  });
  const cited = new Set(qaResult.citationChunkIds);
  const citations = chunks
    .filter((chunk) => cited.has(chunk.id))
    .map((chunk) => ({
      chunkId: chunk.id,
      pageNumber: chunk.pageNumber ?? null,
      snippet: chunk.content.slice(0, 200),
    }));

  await recordQAUsage(supabase, {
    userId: user.id,
    documentId: document.id,
    inputChars: parsed.data.question.length + chunks.reduce((sum, chunk) => sum + chunk.content.length, 0),
    outputChars: qaResult.answer.length,
  });

  return NextResponse.json({
    answer: qaResult.answer,
    citations,
  });
}

async function recordQAUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: { userId: string; documentId: string; inputChars: number; outputChars: number },
) {
  const provider = getQAProviderName();
  const model = provider === "openai" ? getQAModel() : "mock";
  const embeddingProvider = getEmbeddingProviderName();
  const embeddingModel = embeddingProvider === "openai" ? getEmbeddingModel() : "mock";

  try {
    await supabase.from("usage_metrics").insert({
      user_id: input.userId,
      document_id: input.documentId,
      job_type: "qa_question",
      provider,
      model: `${model}; embedding=${embeddingProvider}/${embeddingModel}`,
      input_token_count: Math.ceil(input.inputChars / 4),
      output_token_count: Math.ceil(input.outputChars / 4),
      status: "completed",
      error_message: null,
    });
  } catch (error) {
    console.warn("Q&A usage metric insert failed.", {
      documentId: input.documentId,
      message: error instanceof Error ? error.message : "Unknown usage metric error.",
    });
  }
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
