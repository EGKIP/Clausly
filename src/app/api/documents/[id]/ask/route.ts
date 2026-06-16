import { NextResponse } from "next/server";
import { z } from "zod";
import { getEmbeddingModel, getEmbeddingProvider, getEmbeddingProviderName } from "@/lib/ai/embeddings/provider";
import { getQAModel, getQAProvider, getQAProviderName } from "@/lib/ai/qa/provider";
import { encodeSseFrame } from "@/lib/ai/qa/sse";
import { getQAStreamProvider } from "@/lib/ai/qa/stream";
import { canAskQuestion } from "@/lib/billing/qa-rate-limit";
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

type AskChunk = {
  id: string;
  content: string;
  pageNumber: number | null;
};

type AskCitation = {
  chunkId: string;
  pageNumber: number | null;
  snippet: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const wantsStream = request.headers.get("accept")?.includes("text/event-stream") ?? false;

  if (!hasSupabaseEnv()) {
    if (wantsStream) {
      return streamMockResponse({
        citations: [
          {
            chunkId: "demo-chunk",
            pageNumber: 1,
            snippet: "Demo citation excerpt from this contract.",
          },
        ],
        answer: "Ask Clausly is running in demo mode. Connect Supabase to answer from indexed document text.",
      });
    }

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

  const gate = await canAskQuestion(supabase, user.id);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: `You've reached your ${gate.limit}-question daily limit on the ${gate.plan} plan.`,
        code: "QA_RATE_LIMIT",
        limit: gate.limit,
        used: gate.used,
        resetsAt: gate.resetsAt,
        plan: gate.plan,
      },
      { status: 429 }
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

  if (wantsStream) {
    const citations = chunks.map((chunk) => ({
      chunkId: chunk.id,
      pageNumber: chunk.pageNumber ?? null,
      snippet: chunk.content.slice(0, 200),
    }));

    return streamAskResponse({
      supabase,
      userId: user.id,
      documentId: document.id,
      question: parsed.data.question,
      chunks,
      citations,
    });
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

function streamAskResponse(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  documentId: string;
  question: string;
  chunks: AskChunk[];
  citations: AskCitation[];
}) {
  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        let answer = "";
        controller.enqueue(encodeSseFrame("citations", { citations: input.citations }));

        try {
          for await (const event of getQAStreamProvider()({
            question: input.question,
            chunks: input.chunks,
          })) {
            if (event.type === "token") {
              answer += event.text;
              controller.enqueue(encodeSseFrame("token", { text: event.text }));
            } else if (event.type === "error") {
              controller.enqueue(encodeSseFrame("error", { message: event.message }));
              await recordQAUsage(input.supabase, {
                userId: input.userId,
                documentId: input.documentId,
                inputChars: input.question.length + input.chunks.reduce((sum, chunk) => sum + chunk.content.length, 0),
                outputChars: answer.length,
                status: "failed",
                errorMessage: event.message,
              });
              controller.close();
              return;
            } else {
              await recordQAUsage(input.supabase, {
                userId: input.userId,
                documentId: input.documentId,
                inputChars: input.question.length + input.chunks.reduce((sum, chunk) => sum + chunk.content.length, 0),
                outputChars: answer.length,
              });
              controller.enqueue(encodeSseFrame("done", {}));
              controller.close();
              return;
            }
          }

          controller.enqueue(encodeSseFrame("done", {}));
          controller.close();
        } catch (error) {
          controller.enqueue(encodeSseFrame("error", {
            message: error instanceof Error ? error.message : "Ask Clausly streaming failed.",
          }));
          controller.close();
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    },
  );
}

function streamMockResponse(input: { citations: AskCitation[]; answer: string }) {
  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encodeSseFrame("citations", { citations: input.citations }));
        for (const [index, word] of input.answer.split(/\s+/).filter(Boolean).entries()) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          controller.enqueue(encodeSseFrame("token", { text: index === 0 ? word : ` ${word}` }));
        }
        controller.enqueue(encodeSseFrame("done", {}));
        controller.close();
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    },
  );
}

async function recordQAUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    userId: string;
    documentId: string;
    inputChars: number;
    outputChars: number;
    status?: "completed" | "failed";
    errorMessage?: string | null;
  },
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
      status: input.status ?? "completed",
      error_message: input.errorMessage ?? null,
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
