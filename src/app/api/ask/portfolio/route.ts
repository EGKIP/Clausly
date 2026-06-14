import { NextResponse } from "next/server";
import { z } from "zod";
import { getEmbeddingModel, getEmbeddingProvider, getEmbeddingProviderName } from "@/lib/ai/embeddings/provider";
import { getPortfolioQAProvider, type PortfolioQAChunk } from "@/lib/ai/qa/portfolio-provider";
import { createClient } from "@/lib/supabase/server";

const questionSchema = z.object({
  question: z.string().trim().min(3).max(500),
}).strict();

type MatchChunk = {
  id: string;
  document_id: string;
  content: string;
  page_number: number | null;
};

type DocumentTitle = {
  id: string;
  title: string;
};

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({
      answer: "Portfolio Ask is running in demo mode. Connect Supabase to answer across indexed documents.",
      citations: [
        {
          documentId: "demo-lease",
          documentTitle: "Demo Lease",
          chunkId: "demo-lease-chunk",
          pageNumber: 2,
          snippet: "The demo lease renews unless notice is sent before the deadline.",
        },
        {
          documentId: "demo-nda",
          documentTitle: "Demo NDA",
          chunkId: "demo-nda-chunk",
          pageNumber: 1,
          snippet: "The demo NDA keeps confidentiality obligations active after termination.",
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

  const [questionEmbedding] = await getEmbeddingProvider()([parsed.data.question]);
  const { data: matches, error: matchError } = await supabase.rpc("match_portfolio_chunks", {
    query_embedding: questionEmbedding,
    match_count: 12,
    per_doc_cap: 3,
  });

  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 });

  const matchedChunks = (matches ?? []) as MatchChunk[];
  if (matchedChunks.length === 0) {
    return NextResponse.json(
      { error: "Upload a document first.", code: "PORTFOLIO_EMPTY" },
      { status: 409 }
    );
  }

  const documentIds = [...new Set(matchedChunks.map((chunk) => chunk.document_id))];
  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id, title")
    .in("id", documentIds);

  if (documentsError) return NextResponse.json({ error: documentsError.message }, { status: 500 });

  const titleById = new Map((documents ?? [] as DocumentTitle[]).map((document) => [document.id, document.title]));
  const chunks: PortfolioQAChunk[] = matchedChunks.map((chunk) => ({
    id: chunk.id,
    documentId: chunk.document_id,
    documentTitle: titleById.get(chunk.document_id) ?? "Untitled document",
    content: chunk.content,
    pageNumber: chunk.page_number,
  }));

  const qaResult = await getPortfolioQAProvider()({
    question: parsed.data.question,
    chunks,
  });
  const cited = new Set(qaResult.citationChunkIds);
  const citations = chunks
    .filter((chunk) => cited.has(chunk.id))
    .map((chunk) => ({
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      chunkId: chunk.id,
      pageNumber: chunk.pageNumber ?? null,
      snippet: chunk.content.slice(0, 200),
    }));

  await recordPortfolioUsage(supabase, {
    userId: user.id,
    inputChars: parsed.data.question.length + chunks.reduce((sum, chunk) => sum + chunk.content.length, 0),
    outputChars: qaResult.answer.length,
  });

  return NextResponse.json({
    answer: qaResult.answer,
    citations,
  });
}

async function recordPortfolioUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: { userId: string; inputChars: number; outputChars: number },
) {
  const embeddingProvider = getEmbeddingProviderName();
  const embeddingModel = embeddingProvider === "openai" ? getEmbeddingModel() : "mock";

  try {
    await supabase.from("usage_metrics").insert({
      user_id: input.userId,
      document_id: null,
      job_type: "qa_portfolio",
      provider: process.env.CLAUSLY_AI_PROVIDER?.trim().toLowerCase() === "openai" ? "openai" : "mock",
      model: `embedding=${embeddingProvider}/${embeddingModel}`,
      input_token_count: Math.ceil(input.inputChars / 4),
      output_token_count: Math.ceil(input.outputChars / 4),
      status: "completed",
      error_message: null,
    });
  } catch (error) {
    console.warn("Portfolio Q&A usage metric insert failed.", {
      userId: input.userId,
      message: error instanceof Error ? error.message : "Unknown usage metric error.",
    });
  }
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
