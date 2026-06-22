import type { Clause } from "@/lib/db/types";

export type ClauseAlignmentPair = {
  aClause?: Clause;
  bClause?: Clause;
  similarity: number | null;
};

export type ClauseAlignmentResult = {
  pairs: ClauseAlignmentPair[];
  unmatchedA: Clause[];
  unmatchedB: Clause[];
};

const DEFAULT_THRESHOLD = 0.65;

export function alignClauses(
  clausesA: Clause[],
  clausesB: Clause[],
  embeddings: number[][],
  options: { threshold?: number } = {}
): ClauseAlignmentResult {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const embeddingsA = embeddings.slice(0, clausesA.length);
  const embeddingsB = embeddings.slice(clausesA.length, clausesA.length + clausesB.length);
  const candidates = buildCandidates(clausesA, clausesB, embeddingsA, embeddingsB, threshold);
  const usedA = new Set<number>();
  const usedB = new Set<number>();
  const pairs: ClauseAlignmentPair[] = [];

  for (const candidate of candidates) {
    if (usedA.has(candidate.aIndex) || usedB.has(candidate.bIndex)) continue;
    usedA.add(candidate.aIndex);
    usedB.add(candidate.bIndex);
    pairs.push({
      aClause: clausesA[candidate.aIndex],
      bClause: clausesB[candidate.bIndex],
      similarity: candidate.similarity,
    });
  }

  const unmatchedA = clausesA.filter((_, index) => !usedA.has(index));
  const unmatchedB = clausesB.filter((_, index) => !usedB.has(index));

  return {
    pairs: [
      ...pairs,
      ...unmatchedA.map((clause) => ({ aClause: clause, similarity: null })),
      ...unmatchedB.map((clause) => ({ bClause: clause, similarity: null })),
    ],
    unmatchedA,
    unmatchedB,
  };
}

function buildCandidates(
  clausesA: Clause[],
  clausesB: Clause[],
  embeddingsA: number[][],
  embeddingsB: number[][],
  threshold: number
) {
  const candidates: Array<{
    aIndex: number;
    bIndex: number;
    similarity: number;
    categoryMatch: boolean;
  }> = [];

  for (let aIndex = 0; aIndex < clausesA.length; aIndex += 1) {
    for (let bIndex = 0; bIndex < clausesB.length; bIndex += 1) {
      const similarity = cosineSimilarity(embeddingsA[aIndex], embeddingsB[bIndex]);
      if (similarity < threshold) continue;
      candidates.push({
        aIndex,
        bIndex,
        similarity,
        categoryMatch: clausesA[aIndex].category === clausesB[bIndex].category,
      });
    }
  }

  return candidates.sort((left, right) => {
    // Tie-break contract: same-category match > higher similarity > earlier
    // A index > earlier B index. This keeps matches stable when embeddings tie.
    if (left.categoryMatch !== right.categoryMatch) return left.categoryMatch ? -1 : 1;
    if (left.similarity !== right.similarity) return right.similarity - left.similarity;
    if (left.aIndex !== right.aIndex) return left.aIndex - right.aIndex;
    return left.bIndex - right.bIndex;
  });
}

export function cosineSimilarity(a: number[] | undefined, b: number[] | undefined) {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    aMagnitude += a[index] ** 2;
    bMagnitude += b[index] ** 2;
  }
  if (aMagnitude === 0 || bMagnitude === 0) return 0;
  return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude));
}
