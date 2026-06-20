import { BookOpen, Upload } from "lucide-react";
import { ClauseLibrary } from "@/components/dashboard/clauses/clause-library";
import type { ClauseFacet, ClauseLibraryItem, ClauseRiskLevel } from "@/components/dashboard/clauses/types";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { PortfolioEmptyState } from "@/components/dashboard/empty-states/portfolio-empty";
import { Button } from "@/components/ui/button";
import { clauses as mockClauses } from "@/lib/mock-clauses";
import { documents as mockDocuments } from "@/lib/mock-data";
import { apiRiskToUi, type ClauseRow, type DocumentRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

const FIRST_PAGE_LIMIT = 50;

export default async function ClausesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const documentId = firstParam(params?.documentId);
  const data = await getInitialClauseLibrary(documentId);

  if (data.documentCount === 0) {
    return (
      <PageBody>
        <PortfolioEmptyState variant="documents" />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow={
          <>
            <BookOpen className="mr-1 inline size-3 -mt-0.5" />
            Clause library
          </>
        }
        title="Clauses across your portfolio"
        description="Search and compare the extracted clauses Clausly found across your uploaded contracts. Informational only, not legal advice."
        actions={
          <Button href="/dashboard/documents?upload=1" variant="primary" size="md" className="min-h-11 w-full sm:w-auto">
            <Upload className="size-3.5" />
            Upload
          </Button>
        }
      />

      <ClauseLibrary
        initialClauses={data.clauses}
        initialNextCursor={data.nextCursor}
        totalCount={data.totalCount}
        categoryFacets={data.categoryFacets}
        riskFacets={data.riskFacets}
        initialFilters={{ documentId: documentId ?? undefined }}
      />
    </PageBody>
  );
}

async function getInitialClauseLibrary(documentId: string | null) {
  if (!hasSupabaseEnv()) return getMockClauseLibrary(documentId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return emptyClauseLibrary(0);
  }

  const { count: documentCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (!documentCount) return emptyClauseLibrary(0);

  let clauseQuery = supabase
    .from("clauses")
    .select("*")
    .eq("user_id", user.id);
  if (documentId) clauseQuery = clauseQuery.eq("document_id", documentId);

  const { data: clauseRows, error: clauseError } = await clauseQuery
    .order("created_at", { ascending: false })
    .limit(FIRST_PAGE_LIMIT + 1);
  if (clauseError) throw clauseError;

  let facetQuery = supabase
    .from("clauses")
    .select("category,risk_level")
    .eq("user_id", user.id);
  if (documentId) facetQuery = facetQuery.eq("document_id", documentId);
  const { data: facetRows, error: facetError } = await facetQuery;
  if (facetError) throw facetError;

  const rows = ((clauseRows ?? []) as ClauseRow[]).slice(0, FIRST_PAGE_LIMIT);
  const documentTitles = await getDocumentTitles(supabase, user.id, rows.map((row) => row.document_id));

  return {
    documentCount,
    clauses: rows.map((row) => toClauseLibraryItem(row, documentTitles.get(row.document_id))),
    nextCursor: (clauseRows ?? []).length > FIRST_PAGE_LIMIT && rows.length > 0
      ? encodeCursor({ createdAt: rows[rows.length - 1].created_at })
      : null,
    totalCount: (facetRows ?? []).length,
    categoryFacets: buildCategoryFacets(facetRows ?? []),
    riskFacets: buildRiskFacets(facetRows ?? []),
  };
}

async function getDocumentTitles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  documentIds: string[]
) {
  const titles = new Map<string, string>();
  const uniqueIds = Array.from(new Set(documentIds));
  if (uniqueIds.length === 0) return titles;

  const { data } = await supabase
    .from("documents")
    .select("id,title")
    .eq("user_id", userId)
    .in("id", uniqueIds);

  for (const document of (data ?? []) as Pick<DocumentRow, "id" | "title">[]) {
    titles.set(document.id, document.title);
  }
  return titles;
}

function getMockClauseLibrary(documentId: string | null) {
  const filtered = documentId
    ? mockClauses.filter((clause) => clause.docId === documentId)
    : mockClauses;
  const titleById = new Map(mockDocuments.map((document) => [document.id, document.title]));
  return {
    documentCount: mockDocuments.length,
    clauses: filtered.slice(0, FIRST_PAGE_LIMIT).map((clause) => ({
      id: clause.id,
      documentId: clause.docId,
      documentTitle: titleById.get(clause.docId) ?? "Untitled document",
      title: clause.title,
      category: clause.category,
      risk: clause.risk,
      riskLevel: uiRiskToApi(clause.risk),
      page: clause.page,
      sourceQuote: clause.quote,
      plainEnglish: clause.plainEnglish,
      createdAt: "2026-06-01T00:00:00.000Z",
    })),
    nextCursor: filtered.length > FIRST_PAGE_LIMIT ? encodeCursor({ createdAt: "2026-06-01T00:00:00.000Z" }) : null,
    totalCount: filtered.length,
    categoryFacets: buildCategoryFacets(filtered.map((clause) => ({ category: clause.category }))),
    riskFacets: buildRiskFacets(filtered.map((clause) => ({ risk_level: uiRiskToApi(clause.risk) }))),
  };
}

function emptyClauseLibrary(documentCount: number) {
  return {
    documentCount,
    clauses: [] as ClauseLibraryItem[],
    nextCursor: null,
    totalCount: 0,
    categoryFacets: [] as ClauseFacet[],
    riskFacets: [] as ClauseFacet[],
  };
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

function buildCategoryFacets(rows: Array<{ category: string }>) {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(row.category, (counts.get(row.category) ?? 0) + 1));
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => ({ value, label: value, count }));
}

function buildRiskFacets(rows: Array<{ risk_level: ClauseRiskLevel }>) {
  const order: ClauseRiskLevel[] = ["high", "needs_review", "medium", "low"];
  const counts = new Map<ClauseRiskLevel, number>();
  rows.forEach((row) => counts.set(row.risk_level, (counts.get(row.risk_level) ?? 0) + 1));
  return order
    .filter((value) => counts.has(value))
    .map((value) => ({ value, label: apiRiskToUi[value], count: counts.get(value) ?? 0 }));
}

function encodeCursor(cursor: { createdAt: string }) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function uiRiskToApi(risk: string): ClauseRiskLevel {
  if (risk === "Low") return "low";
  if (risk === "Medium") return "medium";
  if (risk === "High") return "high";
  return "needs_review";
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
