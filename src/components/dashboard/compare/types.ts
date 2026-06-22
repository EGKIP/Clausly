import type { TextDiffSegment } from "@/lib/ai/compare/diff";
import type { Clause } from "@/lib/db/types";
import type { ContractDoc } from "@/lib/mock-data";

export type CompareDocumentSummary = Pick<ContractDoc, "id" | "title" | "type" | "party">;

export type CompareApiDocument = {
  id: string;
  title: string;
  document_type: string;
};

export type ComparePair = {
  aClause?: Clause;
  bClause?: Clause;
  similarity: number | null;
  diff?: TextDiffSegment[];
};

export type CompareResponse = {
  a: CompareApiDocument;
  b: CompareApiDocument;
  pairs: ComparePair[];
  unmatchedA: Clause[];
  unmatchedB: Clause[];
};
