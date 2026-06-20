export type ClauseRiskLevel = "low" | "medium" | "high" | "needs_review";

export type ClauseLibraryItem = {
  id: string;
  documentId: string;
  documentTitle: string;
  title: string;
  category: string;
  risk: "Low" | "Medium" | "High" | "Needs Review";
  riskLevel: ClauseRiskLevel;
  page: number;
  sourceQuote: string;
  plainEnglish: string;
  createdAt: string;
};

export type ClauseFacet = {
  value: string;
  label: string;
  count: number;
};

export type ClauseLibraryInitialFilters = {
  documentId?: string;
};
