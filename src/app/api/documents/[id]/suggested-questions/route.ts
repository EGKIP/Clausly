import { NextResponse, after } from "next/server";
import { getEmbeddingProvider } from "@/lib/ai/embeddings/provider";
import { generateDocumentSuggestions } from "@/lib/ai/qa/suggest";
import { canAskQuestion } from "@/lib/billing/qa-rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type MatchChunk = {
  id: string;
  content: string;
  page_number: number | null;
};

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const anchor = "key terms, dates, obligations, renewal, notice, fees, termination";
const canned = [
  "What's the termination clause?",
  "When does this auto-renew?",
  "What notice period applies?",
  "Which fees could surprise me?",
];

export async function GET(_request: Request, context: RouteContext) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ suggestions: canned, pending: false });
  }

  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (documentError) {
    if (documentError.code === "PGRST116") {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    return NextResponse.json({ error: documentError.message }, { status: 500 });
  }
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const cached = await getCachedSuggestions(supabase, document.id);
  if (cached) return NextResponse.json({ suggestions: cached, pending: false });

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

  // after() keeps the serverless function alive until generation finishes —
  // a bare detached promise dies with the response on Vercel, which left
  // suggestions permanently ungenerated and the UI stuck on "pending".
  after(async () => {
    try {
      await generateAndPersistSuggestions(supabase, document.id, user.id);
    } catch (error) {
      console.error("Document suggestion generation failed.", {
        documentId: document.id,
        message: error instanceof Error ? error.message : "Unknown suggestion generation error.",
      });
    }
  });

  return NextResponse.json({ suggestions: [], pending: true });
}

async function getCachedSuggestions(supabase: Awaited<ReturnType<typeof createClient>>, documentId: string) {
  const { data, error } = await supabase
    .from("document_suggestions")
    .select("suggestions, generated_at")
    .eq("document_id", documentId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  if (Date.now() - new Date(data.generated_at).getTime() > CACHE_TTL_MS) return null;
  return sanitizeSuggestions(data.suggestions);
}

async function generateAndPersistSuggestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  userId: string
) {
  const [embedding] = await getEmbeddingProvider()([anchor]);
  const { data, error } = await supabase.rpc("match_document_chunks", {
    target_document_id: documentId,
    query_embedding: embedding,
    match_count: 5,
  });
  if (error) throw new Error(error.message);

  const chunks = ((data ?? []) as MatchChunk[]).map((chunk) => ({
    id: chunk.id,
    content: chunk.content,
    pageNumber: chunk.page_number,
  }));

  const suggestions = await generateDocumentSuggestions(chunks);
  await persistSuggestions(supabase, documentId, suggestions);
  await recordSuggestUsage(supabase, userId, documentId, suggestions.join(" ").length);
}

async function persistSuggestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  suggestions: string[]
) {
  const existing = await supabase
    .from("document_suggestions")
    .select("document_id")
    .eq("document_id", documentId)
    .single();

  const payload = {
    suggestions,
    generated_at: new Date().toISOString(),
  };

  const result = existing.data
    ? await supabase.from("document_suggestions").update(payload).eq("document_id", documentId)
    : await supabase.from("document_suggestions").insert({ document_id: documentId, ...payload });

  if (result.error) throw new Error(result.error.message);
}

async function recordSuggestUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  documentId: string,
  outputChars: number
) {
  await supabase.from("usage_metrics").insert({
    user_id: userId,
    document_id: documentId,
    job_type: "qa_suggest",
    provider: process.env.CLAUSLY_AI_PROVIDER?.trim().toLowerCase() === "openai" ? "openai" : "mock",
    model: "suggestions",
    input_token_count: Math.ceil(anchor.length / 4),
    output_token_count: Math.ceil(outputChars / 4),
    status: "completed",
    error_message: null,
  });
}

function sanitizeSuggestions(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 4) : [];
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
