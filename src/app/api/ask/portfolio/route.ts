import { NextResponse } from "next/server";
import { z } from "zod";
import { getEmbeddingModel, getEmbeddingProvider, getEmbeddingProviderName } from "@/lib/ai/embeddings/provider";
import { encodeSseFrame } from "@/lib/ai/qa/sse";
import {
  getPortfolioQAProvider,
  getPortfolioQAStreamProvider,
  type PortfolioQAChunk,
} from "@/lib/ai/qa/portfolio-provider";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { auditRequestMetadata, recordAuditEvent } from "@/lib/audit/log";
import { canAskQuestion } from "@/lib/billing/qa-rate-limit";
import {
  appendMessage,
  getOrCreateConversation,
  loadConversationMessages,
  touchConversation,
  type ConversationMessage,
  type ConversationRef,
} from "@/lib/db/conversations";
import { createClient } from "@/lib/supabase/server";

const questionSchema = z.object({
  question: z.string().trim().min(3).max(500),
  conversationId: z.string().uuid().optional(),
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
  const wantsStream = request.headers.get("accept")?.includes("text/event-stream") ?? false;

  if (!hasSupabaseEnv()) {
    if (wantsStream) {
      return streamMockPortfolioResponse({
        answer: "Portfolio Ask is running in demo mode. Connect Supabase to answer across indexed documents.",
        citations: demoCitations(),
      });
    }

    return NextResponse.json({
      answer: "Portfolio Ask is running in demo mode. Connect Supabase to answer across indexed documents.",
      citations: demoCitations(),
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

  let conversation: ConversationRef;
  let history: ConversationMessage[];
  try {
    conversation = await getOrCreateConversation(
      supabase,
      user.id,
      null,
      parsed.data.question,
      parsed.data.conversationId
    );
    history = await loadConversationMessages(supabase, user.id, conversation.id, 10);
    await appendMessage(supabase, conversation.id, "user", parsed.data.question);
    if (conversation.isNew) {
      try {
        await recordAuditEvent(supabase, {
          userId: user.id,
          action: AUDIT_ACTIONS.CONVERSATION_CREATED,
          resourceType: "qa_conversation",
          resourceId: conversation.id,
          metadata: {
            scope: "portfolio",
            ...auditRequestMetadata(request),
          },
        });
      } catch {
        // Audit logging is best-effort; conversation creation remains the source of truth.
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "ConversationNotFoundError") {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Conversation could not be loaded." },
      { status: 500 }
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
  const allCitations = chunks.map((chunk) => ({
    documentId: chunk.documentId,
    documentTitle: chunk.documentTitle,
    chunkId: chunk.id,
    pageNumber: chunk.pageNumber ?? null,
    snippet: chunk.content.slice(0, 200),
  }));

  if (wantsStream) {
    return streamPortfolioResponse({
      supabase,
      userId: user.id,
      conversation,
      question: parsed.data.question,
      chunks,
      citations: allCitations,
      history,
    });
  }

  const qaResult = await getPortfolioQAProvider()(buildPortfolioQAInput(parsed.data.question, chunks, history));
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
  await appendMessage(supabase, conversation.id, "assistant", qaResult.answer, citations);
  await touchConversation(supabase, conversation.id);

  return NextResponse.json({
    answer: qaResult.answer,
    citations,
    conversation,
  });
}

function streamPortfolioResponse(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  conversation: ConversationRef;
  question: string;
  chunks: PortfolioQAChunk[];
  citations: Array<{
    documentId: string;
    documentTitle: string;
    chunkId: string;
    pageNumber: number | null;
    snippet: string;
  }>;
  history: ConversationMessage[];
}) {
  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        let answer = "";
        if (input.conversation.isNew) {
          controller.enqueue(encodeSseFrame("conversation", {
            conversation: {
              id: input.conversation.id,
              title: input.conversation.title,
              isNew: true,
            },
          }));
        }
        controller.enqueue(encodeSseFrame("citations", { citations: input.citations }));

        try {
          for await (const event of getPortfolioQAStreamProvider()(buildPortfolioQAInput(input.question, input.chunks, input.history))) {
            if (event.type === "token") {
              answer += event.text;
              controller.enqueue(encodeSseFrame("token", { text: event.text }));
            } else if (event.type === "error") {
              controller.enqueue(encodeSseFrame("error", { message: event.message }));
              await recordPortfolioUsage(input.supabase, {
                userId: input.userId,
                inputChars: input.question.length + input.chunks.reduce((sum, chunk) => sum + chunk.content.length, 0),
                outputChars: answer.length,
                status: "failed",
                errorMessage: event.message,
              });
              controller.close();
              return;
            } else {
              await recordPortfolioUsage(input.supabase, {
                userId: input.userId,
                inputChars: input.question.length + input.chunks.reduce((sum, chunk) => sum + chunk.content.length, 0),
                outputChars: answer.length,
              });
              await appendMessage(input.supabase, input.conversation.id, "assistant", answer, input.citations);
              await touchConversation(input.supabase, input.conversation.id);
              controller.enqueue(encodeSseFrame("done", {}));
              controller.close();
              return;
            }
          }

          controller.enqueue(encodeSseFrame("done", {}));
          controller.close();
        } catch (error) {
          controller.enqueue(encodeSseFrame("error", {
            message: error instanceof Error ? error.message : "Portfolio Ask streaming failed.",
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

function buildPortfolioQAInput(question: string, chunks: PortfolioQAChunk[], history: ConversationMessage[]) {
  const qaInput: {
    question: string;
    chunks: PortfolioQAChunk[];
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  } = {
    question,
    chunks,
  };
  if (history.length > 0) {
    qaInput.history = history.map((message) => ({ role: message.role, content: message.content }));
  }
  return qaInput;
}

function streamMockPortfolioResponse(input: { answer: string; citations: ReturnType<typeof demoCitations> }) {
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

async function recordPortfolioUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    userId: string;
    inputChars: number;
    outputChars: number;
    status?: "completed" | "failed";
    errorMessage?: string | null;
  },
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
      status: input.status ?? "completed",
      error_message: input.errorMessage ?? null,
    });
  } catch (error) {
    console.warn("Portfolio Q&A usage metric insert failed.", {
      userId: input.userId,
      message: error instanceof Error ? error.message : "Unknown usage metric error.",
    });
  }
}

function demoCitations() {
  return [
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
  ];
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
