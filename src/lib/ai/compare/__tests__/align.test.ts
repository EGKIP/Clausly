import { describe, expect, it } from "vitest";
import { alignClauses } from "../align";
import type { Clause } from "@/lib/db/types";

describe("alignClauses", () => {
  it("matches clauses with perfect semantic similarity", () => {
    const result = alignClauses(
      [clause("a1", "Renewal")],
      [clause("b1", "Renewal")],
      [[1, 0], [1, 0]]
    );

    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0]).toMatchObject({
      aClause: { id: "a1" },
      bClause: { id: "b1" },
      similarity: 1,
    });
    expect(result.unmatchedA).toEqual([]);
    expect(result.unmatchedB).toEqual([]);
  });

  it("prefers same-category matches when similarity ties", () => {
    const result = alignClauses(
      [clause("a1", "Renewal")],
      [clause("b1", "Payment"), clause("b2", "Renewal")],
      [[1, 0], [1, 0], [1, 0]]
    );

    expect(result.pairs[0].bClause?.id).toBe("b2");
  });

  it("keeps partial matches and reports unmatched clauses", () => {
    const result = alignClauses(
      [clause("a1", "Renewal"), clause("a2", "Payment")],
      [clause("b1", "Renewal")],
      [[1, 0], [0, 1], [1, 0]]
    );

    expect(result.pairs.some((pair) => pair.aClause?.id === "a1" && pair.bClause?.id === "b1")).toBe(true);
    expect(result.unmatchedA.map((item) => item.id)).toEqual(["a2"]);
    expect(result.unmatchedB).toEqual([]);
  });

  it("does not match clauses below the similarity threshold", () => {
    const result = alignClauses(
      [clause("a1", "Renewal")],
      [clause("b1", "Renewal")],
      [[1, 0], [0, 1]]
    );

    expect(result.pairs).toEqual([
      { aClause: expect.objectContaining({ id: "a1" }), similarity: null },
      { bClause: expect.objectContaining({ id: "b1" }), similarity: null },
    ]);
    expect(result.unmatchedA.map((item) => item.id)).toEqual(["a1"]);
    expect(result.unmatchedB.map((item) => item.id)).toEqual(["b1"]);
  });
});

function clause(id: string, category: Clause["category"]): Clause {
  return {
    id,
    documentId: "doc-" + id,
    title: "Clause " + id,
    category,
    riskLevel: "medium",
    page: 1,
    sourceQuote: "Sample source quote.",
    plainEnglish: "Sample plain English.",
    whyItMatters: "Sample rationale.",
    confidence: 0.9,
    bbox: null,
  };
}
