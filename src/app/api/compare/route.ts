import { NextResponse } from "next/server";
import { alignClauses } from "@/lib/ai/compare/align";
import { textDiff } from "@/lib/ai/compare/diff";
import { getEmbeddingModel, getEmbeddingProvider, getEmbeddingProviderName } from "@/lib/ai/embeddings/provider";
import { canAskQuestion } from "@/lib/billing/qa-rate-limit";
import { toApiClause } from "@/lib/db/adapters";
import type { Clause, ClauseRow, DocumentRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

type CompareDocument = Pick<DocumentRow, "id" | "title" | "document_type">;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const aId = url.searchParams.get("a");
  const bId = url.searchParams.get("b");

  if (!hasSupabaseEnv()) {
    return NextResponse.json(mockCompareResponse(aId ?? "demo-a", bId ?? "demo-b"));
  }

  if (!aId || !bId || aId === bId) {
    return NextResponse.json({ error: "Choose two different documents to compare." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const [aDocument, bDocument] = await Promise.all([
    getOwnedDocument(supabase, aId, user.id),
    getOwnedDocument(supabase, bId, user.id),
  ]);

  if (aDocument.error) return aDocument.response;
  if (bDocument.error) return bDocument.response;

  const [aClauses, bClauses] = await Promise.all([
    getDocumentClauses(supabase, aId, user.id),
    getDocumentClauses(supabase, bId, user.id),
  ]);

  if (aClauses.error) return aClauses.response;
  if (bClauses.error) return bClauses.response;

  const [aEmbeddings, bEmbeddings] = await Promise.all([
    embedClauses(aClauses.clauses),
    embedClauses(bClauses.clauses),
  ]);
  const aligned = alignClauses(aClauses.clauses, bClauses.clauses, [...aEmbeddings, ...bEmbeddings]);
  const pairs = aligned.pairs.map((pair) => ({
    ...pair,
    diff: pair.aClause && pair.bClause
      ? textDiff(pair.aClause.sourceQuote, pair.bClause.sourceQuote)
      : undefined,
  }));

  await recordCompareUsage(supabase, {
    userId: user.id,
    documentId: aId,
    inputChars: [...aClauses.clauses, ...bClauses.clauses].reduce((sum, clause) => sum + comparisonText(clause).length, 0),
    outputChars: pairs.reduce((sum, pair) => sum + (pair.diff?.reduce((partSum, part) => partSum + part.value.length, 0) ?? 0), 0),
  });

  return NextResponse.json({
    a: aDocument.document,
    b: bDocument.document,
    pairs,
    unmatchedA: aligned.unmatchedA,
    unmatchedB: aligned.unmatchedB,
  });
}

async function getOwnedDocument(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  userId: string
): Promise<{ document: CompareDocument; error: false } | { response: NextResponse; error: true }> {
  const { data, error } = await supabase
    .from("documents")
    .select("id,title,document_type")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { response: NextResponse.json({ error: "Document not found." }, { status: 404 }), error: true };
    }
    return { response: NextResponse.json({ error: error.message }, { status: 500 }), error: true };
  }
  if (!data) {
    return { response: NextResponse.json({ error: "Document not found." }, { status: 404 }), error: true };
  }

  return { document: data as CompareDocument, error: false };
}

async function getDocumentClauses(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  userId: string
): Promise<{ clauses: Clause[]; error: false } | { response: NextResponse; error: true }> {
  const { data, error } = await supabase
    .from("clauses")
    .select("*")
    .eq("document_id", documentId)
    .eq("user_id", userId)
    .order("page_number", { ascending: true });

  if (error) {
    return { response: NextResponse.json({ error: error.message }, { status: 500 }), error: true };
  }

  return { clauses: ((data ?? []) as ClauseRow[]).map(toApiClause), error: false };
}

async function embedClauses(clauses: Clause[]) {
  if (clauses.length === 0) return [];
  const provider = getEmbeddingProvider();
  return provider(clauses.map(comparisonText));
}

function comparisonText(clause: Clause) {
  return [
    clause.title,
    clause.category,
    clause.sourceQuote,
    clause.plainEnglish,
    clause.whyItMatters,
  ].join("\n");
}

async function recordCompareUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    userId: string;
    documentId: string;
    inputChars: number;
    outputChars: number;
  }
) {
  const embeddingProvider = getEmbeddingProviderName();
  const embeddingModel = embeddingProvider === "openai" ? getEmbeddingModel() : "mock";
  try {
    await supabase.from("usage_metrics").insert({
      user_id: input.userId,
      document_id: input.documentId,
      job_type: "qa_question",
      provider: "compare",
      model: `clause-align; embedding=${embeddingProvider}/${embeddingModel}`,
      input_token_count: Math.ceil(input.inputChars / 4),
      output_token_count: Math.ceil(input.outputChars / 4),
      status: "completed",
      error_message: null,
    });
  } catch (error) {
    console.warn("Compare usage metric insert failed.", {
      documentId: input.documentId,
      message: error instanceof Error ? error.message : "Unknown usage metric error.",
    });
  }
}

function mockCompareResponse(aId: string, bId: string) {
  const aClause: Clause = {
    id: "demo-a-clause",
    documentId: aId,
    title: "Notice period",
    category: "Renewal",
    riskLevel: "medium",
    page: 4,
    sourceQuote: "Either party must provide 30 days written notice before renewal.",
    plainEnglish: "The old contract requires 30 days notice.",
    whyItMatters: "Short notice windows are easy to miss.",
    confidence: 0.9,
    bbox: null,
  };
  const bClause: Clause = {
    ...aClause,
    id: "demo-b-clause",
    documentId: bId,
    sourceQuote: "Either party must provide 60 days written notice before renewal.",
    plainEnglish: "The new contract requires 60 days notice.",
  };

  return {
    a: { id: aId, title: "Demo contract A", document_type: "lease" },
    b: { id: bId, title: "Demo contract B", document_type: "lease" },
    pairs: [{ aClause, bClause, similarity: 0.92, diff: textDiff(aClause.sourceQuote, bClause.sourceQuote) }],
    unmatchedA: [],
    unmatchedB: [],
  };
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
