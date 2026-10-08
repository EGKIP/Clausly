import { NextResponse, after } from "next/server";
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

// after() only extends the function's life up to maxDuration — give the
// deferred suggestion generation (embedding + LLM call) room to finish.
export const maxDuration = 300;

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Generation (embedding + up to two OpenAI calls, each with a 60s timeout)
// can run longer than the client's poll interval. A lock older than this is
// assumed abandoned (crashed function, etc.) and safe to retry.
const GENERATION_LOCK_MS = 4 * 60 * 1000;
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
  const existing = await getSuggestionRow(supabase, user.id, documentCount);
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
  // polling (every 2.5s, see portfolio-ask.tsx) doesn't re-trigger another
  // full generation — and another usage_metrics charge — before this one
  // finishes and persists.
  await acquireGenerationLock(supabase, user.id, existing.exists);

  // after() keeps the serverless function alive until generation finishes —
  // a bare detached promise dies with the response on Vercel, which left
  // suggestions permanently ungenerated and the UI stuck on "pending".
  after(async () => {
    try {
      await generateAndPersistSuggestions(supabase, user.id, documentCount);
    } catch (error) {
      console.error("Portfolio suggestion generation failed.", {
        userId: user.id,
        message: error instanceof Error ? error.message : "Unknown suggestion generation error.",
      });
      await clearGenerationLock(supabase, user.id);
    }
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

async function getSuggestionRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  documentCount: number
) {
  const { data, error } = await supabase
    .from("portfolio_suggestions")
    .select("suggestions, generated_at, generating_at, document_count")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return { exists: false, cached: null, locked: false };
    throw new Error(error.message);
  }
  if (!data) return { exists: false, cached: null, locked: false };

  const suggestions = sanitizeSuggestions(data.suggestions);
  const fresh =
    data.document_count === documentCount && Date.now() - new Date(data.generated_at).getTime() <= CACHE_TTL_MS;
  const locked = Boolean(data.generating_at) && Date.now() - new Date(data.generating_at as string).getTime() < GENERATION_LOCK_MS;

  return {
    exists: true,
    cached: fresh && suggestions.length > 0 ? suggestions : null,
    locked,
  };
}

async function acquireGenerationLock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  rowExists: boolean
) {
  const generatingAt = new Date().toISOString();
  if (rowExists) {
    await supabase.from("portfolio_suggestions").update({ generating_at: generatingAt }).eq("user_id", userId);
  } else {
    await supabase.from("portfolio_suggestions").insert({
      user_id: userId,
      suggestions: [],
      document_count: 0,
      generated_at: generatingAt,
      generating_at: generatingAt,
    });
  }
}

async function clearGenerationLock(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  await supabase.from("portfolio_suggestions").update({ generating_at: null }).eq("user_id", userId);
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
    generating_at: null,
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
