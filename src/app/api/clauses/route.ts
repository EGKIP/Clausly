import { NextResponse } from "next/server";
import { clauses as mockClauses } from "@/lib/mock-clauses";
import { apiRiskToUi, type ClauseRow, type DocumentRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

type ClauseLibraryItem = {
  id: string;
  documentId: string;
  documentTitle: string;
  title: string;
  category: string;
  risk: string;
  riskLevel: ClauseRow["risk_level"];
  page: number;
  sourceQuote: string;
  plainEnglish: string;
  createdAt: string;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const VALID_RISKS: ClauseRow["risk_level"][] = ["low", "medium", "high", "needs_review"];

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (!hasSupabaseEnv()) {
    return NextResponse.json({
      clauses: mockClauses.slice(0, 3).map((clause) => ({
        id: clause.id,
        documentId: clause.docId,
        documentTitle: "Greenfield lease",
        title: clause.title,
        category: clause.category,
        risk: clause.risk,
        riskLevel: uiRiskToApi(clause.risk),
        page: clause.page,
        sourceQuote: clause.quote,
        plainEnglish: clause.plainEnglish,
        createdAt: "2026-06-01T00:00:00.000Z",
      })),
      nextCursor: null,
      totalCount: 3,
    });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = parseClauseQuery(url.searchParams);
  if ("error" in params) {
    return NextResponse.json({ error: params.error }, { status: 400 });
  }

  let countQuery = supabase.from("clauses").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (params.q) {
    const term = escapeIlikeTerm(params.q);
    countQuery = countQuery.or(`title.ilike.%${term}%,plain_english.ilike.%${term}%,source_quote.ilike.%${term}%`);
  }
  if (params.categories.length > 0) countQuery = countQuery.in("category", params.categories);
  if (params.risks.length > 0) countQuery = countQuery.in("risk_level", params.risks);
  if (params.documentId) countQuery = countQuery.eq("document_id", params.documentId);

  const { count, error: countError } = await countQuery;
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

  let query = supabase.from("clauses").select("*").eq("user_id", user.id);
  if (params.q) {
    const term = escapeIlikeTerm(params.q);
    query = query.or(`title.ilike.%${term}%,plain_english.ilike.%${term}%,source_quote.ilike.%${term}%`);
  }
  if (params.categories.length > 0) query = query.in("category", params.categories);
  if (params.risks.length > 0) query = query.in("risk_level", params.risks);
  if (params.documentId) query = query.eq("document_id", params.documentId);
  if (params.cursor) query = query.lt("created_at", params.cursor.createdAt);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(params.limit + 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = ((data ?? []) as ClauseRow[]).slice(0, params.limit);
  const documentIds = Array.from(new Set(rows.map((row) => row.document_id)));
  const documentTitles = await getDocumentTitles(supabase, user.id, documentIds);
  const hasNextPage = (data ?? []).length > params.limit;
  const cursorRow = rows[rows.length - 1];

  return NextResponse.json({
    clauses: rows.map((row) => toClauseLibraryItem(row, documentTitles.get(row.document_id))),
    nextCursor: hasNextPage && cursorRow ? encodeCursor({ createdAt: cursorRow.created_at }) : null,
    totalCount: count ?? 0,
  });
}

async function getDocumentTitles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  documentIds: string[]
) {
  const titles = new Map<string, string>();
  if (documentIds.length === 0) return titles;

  const { data } = await supabase
    .from("documents")
    .select("id,title")
    .eq("user_id", userId)
    .in("id", documentIds);

  for (const document of (data ?? []) as Pick<DocumentRow, "id" | "title">[]) {
    titles.set(document.id, document.title);
  }
  return titles;
}

function toClauseLibraryItem(row: ClauseRow, documentTitle = "Untitled document"): ClauseLibraryItem {
  return {
    id: row.id,
    documentId: row.document_id,
    documentTitle,
    title: row.title,
    category: row.category,
    risk: apiRiskToUi[row.risk_level],
    riskLevel: row.risk_level,
    page: row.page_number,
    sourceQuote: row.source_quote,
    plainEnglish: row.plain_english,
    createdAt: row.created_at,
  };
}

type ParsedClauseQuery = {
  q: string | null;
  categories: string[];
  risks: ClauseRow["risk_level"][];
  documentId: string | null;
  limit: number;
  cursor: { createdAt: string } | null;
};

function parseClauseQuery(searchParams: URLSearchParams): ParsedClauseQuery | { error: string } {
  const limitValue = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  if (!Number.isFinite(limitValue) || limitValue < 1) return { error: "Invalid limit." };

  const cursorValue = searchParams.get("cursor");
  const cursor = cursorValue ? decodeCursor(cursorValue) : null;
  if (cursorValue && !cursor) return { error: "Invalid cursor." };

  return {
    q: normalizeSearch(searchParams.get("q")),
    categories: parseList(searchParams.get("category")).map(toClauseCategory),
    risks: parseList(searchParams.get("risk")).filter((risk): risk is ClauseRow["risk_level"] =>
      VALID_RISKS.includes(risk as ClauseRow["risk_level"])
    ),
    documentId: searchParams.get("documentId")?.trim() || null,
    limit: Math.min(Math.floor(limitValue), MAX_LIMIT),
    cursor,
  };
}

function parseList(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSearch(value: string | null) {
  const next = value?.trim();
  return next && next.length > 0 ? next.slice(0, 120) : null;
}

function toClauseCategory(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function escapeIlikeTerm(value: string) {
  return value.replace(/[%,]/g, " ").trim();
}

function encodeCursor(cursor: { createdAt: string }) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string): { createdAt: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { createdAt?: unknown };
    if (typeof parsed.createdAt !== "string") return null;
    return { createdAt: parsed.createdAt };
  } catch {
    return null;
  }
}

function uiRiskToApi(risk: string): ClauseRow["risk_level"] {
  if (risk === "Low") return "low";
  if (risk === "Medium") return "medium";
  if (risk === "High") return "high";
  return "needs_review";
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
