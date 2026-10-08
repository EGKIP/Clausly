import { NextResponse, after } from "next/server";
import { getEmbeddingProvider } from "@/lib/ai/embeddings/provider";
import { generateDocumentSuggestions } from "@/lib/ai/qa/suggest";
import { canAskQuestion } from "@/lib/billing/qa-rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// after() only extends the function's life up to maxDuration — give the
// deferred suggestion generation (embedding + LLM call) room to finish.
export const maxDuration = 300;

type MatchChunk = {
  id: string;
  content: string;
  page_number: number | null;
};

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Generation (embedding + up to two OpenAI calls, each with a 60s timeout)
// can run longer than the client's poll interval. A lock older than this is
// assumed abandoned (crashed function, etc.) and safe to retry.
const GENERATION_LOCK_MS = 4 * 60 * 1000;
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

  const existing = await getSuggestionRow(supabase, document.id);
  if (existing.cached) return NextResponse.json({ suggestions: existing.cached, pending: false });
  if (existing.locked) return NextResponse.json({ suggestions: [], pending: true });

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

  // Claim the generation lock before kicking off work so the client's own
  // polling (every 2.5s, see document-view.tsx) doesn't re-trigger another
  // full generation — and another usage_metrics charge — before this one
  // finishes and persists.
  await acquireGenerationLock(supabase, document.id, existing.exists);

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
      await clearGenerationLock(supabase, document.id);
    }
  });

  return NextResponse.json({ suggestions: [], pending: true });
}

async function getSuggestionRow(supabase: Awaited<ReturnType<typeof createClient>>, documentId: string) {
  const { data, error } = await supabase
    .from("document_suggestions")
    .select("suggestions, generated_at, generating_at")
    .eq("document_id", documentId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return { exists: false, cached: null, locked: false };
    throw new Error(error.message);
  }
  if (!data) return { exists: false, cached: null, locked: false };

  const suggestions = sanitizeSuggestions(data.suggestions);
  const fresh = Date.now() - new Date(data.generated_at).getTime() <= CACHE_TTL_MS;
  const locked = Boolean(data.generating_at) && Date.now() - new Date(data.generating_at as string).getTime() < GENERATION_LOCK_MS;

  return {
    exists: true,
    cached: fresh && suggestions.length > 0 ? suggestions : null,
    locked,
  };
}

async function acquireGenerationLock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  rowExists: boolean
) {
  const generatingAt = new Date().toISOString();
  if (rowExists) {
    await supabase.from("document_suggestions").update({ generating_at: generatingAt }).eq("document_id", documentId);
  } else {
    await supabase
      .from("document_suggestions")
      .insert({ document_id: documentId, suggestions: [], generated_at: generatingAt, generating_at: generatingAt });
  }
}

async function clearGenerationLock(supabase: Awaited<ReturnType<typeof createClient>>, documentId: string) {
  await supabase.from("document_suggestions").update({ generating_at: null }).eq("document_id", documentId);
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
    generating_at: null,
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
