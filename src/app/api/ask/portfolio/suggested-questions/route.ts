import { NextResponse } from "next/server";
import { getEmbeddingProvider } from "@/lib/ai/embeddings/provider";
import { generatePortfolioSuggestions } from "@/lib/ai/qa/suggest";
import { canAskQuestion } from "@/lib/billing/qa-rate-limit";
import { canAccessInsights } from "@/lib/billing/plan";
import { createClient } from "@/lib/supabase/server";

type MatchChunk = {
  id: string;
  content: string;
  page_number: number | null;
};

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const anchor = "portfolio key terms, renewal dates, notice windows, obligations, costs, risks";
const canned = [
  "Which contracts renew soon?",
  "Where is my highest monthly cost?",
  "Which agreements need notice?",
  "Which risks appear across documents?",
];

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ suggestions: canned, pending: false });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await canAccessInsights(supabase, user.id);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "Portfolio suggestions require Pro.", code: "INSIGHTS_REQUIRED" },
      { status: 403 }
    );
  }

  const documentCount = await countDocuments(supabase, user.id);
  const cached = await getCachedSuggestions(supabase, user.id, documentCount);
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

  void generateAndPersistSuggestions(supabase, user.id, documentCount).catch((error) => {
    console.warn("Portfolio suggestion generation failed.", {
      userId: user.id,
      message: error instanceof Error ? error.message : "Unknown suggestion generation error.",
    });
  });

  return NextResponse.json({ suggestions: [], pending: true });
}

async function countDocuments(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { count, error } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function getCachedSuggestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  documentCount: number
) {
  const { data, error } = await supabase
    .from("portfolio_suggestions")
    .select("suggestions, generated_at, document_count")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  if (data.document_count !== documentCount) return null;
  if (Date.now() - new Date(data.generated_at).getTime() > CACHE_TTL_MS) return null;
  return sanitizeSuggestions(data.suggestions);
}

async function generateAndPersistSuggestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  documentCount: number
) {
  const [embedding] = await getEmbeddingProvider()([anchor]);
  const { data, error } = await supabase.rpc("match_portfolio_chunks", {
    query_embedding: embedding,
    match_count: 8,
    per_doc_cap: 2,
  });
  if (error) throw new Error(error.message);

  const chunks = ((data ?? []) as MatchChunk[]).map((chunk) => ({
    id: chunk.id,
    content: chunk.content,
    pageNumber: chunk.page_number,
  }));
  const suggestions = await generatePortfolioSuggestions(chunks);
  await persistSuggestions(supabase, userId, documentCount, suggestions);
  await recordSuggestUsage(supabase, userId, suggestions.join(" ").length);
}

async function persistSuggestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  documentCount: number,
  suggestions: string[]
) {
  const existing = await supabase
    .from("portfolio_suggestions")
    .select("user_id")
    .eq("user_id", userId)
    .single();

  const payload = {
    suggestions,
    document_count: documentCount,
    generated_at: new Date().toISOString(),
  };

  const result = existing.data
    ? await supabase.from("portfolio_suggestions").update(payload).eq("user_id", userId)
    : await supabase.from("portfolio_suggestions").insert({ user_id: userId, ...payload });

  if (result.error) throw new Error(result.error.message);
}

async function recordSuggestUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  outputChars: number
) {
  await supabase.from("usage_metrics").insert({
    user_id: userId,
    document_id: null,
    job_type: "qa_suggest",
    provider: process.env.CLAUSLY_AI_PROVIDER?.trim().toLowerCase() === "openai" ? "openai" : "mock",
    model: "portfolio-suggestions",
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
