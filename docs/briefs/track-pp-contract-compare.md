# Track PP — Side-by-side contract comparison

## Goal

Let users pick two contracts (e.g. v1 and v2 of a lease) and see them
side-by-side with clauses aligned and differences highlighted. The
alignment uses semantic similarity on clause content; differences are
shown as a textual diff.

## Non-goals

- Not building automatic version detection (user picks both docs).
- Not exposing the comparison publicly / via share link.
- Not comparing more than two contracts at once.
- Not Pro-gated initially — available to all users (revisit if cost is high).

## Architecture

| File | Purpose |
|---|---|
| `src/lib/ai/compare/align.ts` | `alignClauses(a, b, embeddings)` — Hungarian-style pairing of clauses by cosine similarity |
| `src/lib/ai/compare/diff.ts` | `textDiff(a, b)` — word-level diff (use `diff` npm package or custom LCS) |
| `src/app/api/compare/route.ts` | `GET ?a=<docId>&b=<docId>` → returns aligned clause pairs + diffs |
| `src/app/dashboard/compare/page.tsx` | Server page: parse query params, fetch comparison |
| `src/components/dashboard/compare/compare-view.tsx` | Side-by-side panel with aligned rows |
| `src/components/dashboard/compare/compare-picker.tsx` | Two-doc selector (used when no params) |
| `src/components/dashboard/document-view.tsx` | Add "Compare with…" action in tab bar |

## Database (no migration needed)

Reuses `clauses` table. Reuses existing per-clause embeddings IF available;
if not (clauses don't currently have embeddings), use the QA chunk embeddings
that overlap with each clause's `source_quote` via simple substring match,
OR generate clause-level embeddings on demand using the existing embedding
provider. Use the on-demand approach to avoid a migration.

## Commit cadence (CRITICAL)

**Commit and push after EACH numbered deliverable.** Each commit must
build + lint + test clean.

## Deliverables

### 1. Add `diff` dependency + alignment lib
- `npm install diff` (no migration)
- Write `src/lib/ai/compare/align.ts`:
  - Input: `clausesA: Clause[]`, `clausesB: Clause[]`, `embeddings: number[][]`
  - Output: `{pairs: [a?, b?][], unmatchedA: Clause[], unmatchedB: Clause[]}`
  - Greedy bipartite matching: for each A clause, find best-scoring B clause
    via cosine similarity, threshold 0.65. Ties → category match preferred.
- Write `src/lib/ai/compare/diff.ts`:
  - Wraps the `diff` package's `diffWords` for clean output
  - Returns `Array<{type: 'equal' | 'add' | 'remove', value: string}>`
- Tests: `src/lib/ai/compare/__tests__/align.test.ts` + `diff.test.ts` (8 tests min)
- Commit: `feat(compare): add clause alignment + word-diff helpers`

### 2. API route
- `GET /api/compare?a=<uuid>&b=<uuid>` returns:
  ```ts
  {
    a: { id, title, document_type },
    b: { id, title, document_type },
    pairs: [{ aClause?, bClause?, similarity, diff? }],
    unmatchedA: Clause[],
    unmatchedB: Clause[]
  }
  ```
- Auth: 401 unauth, 404 if either doc isn't owned by user
- Embeds both docs' clauses (cached if any embedding cache exists)
- Counts as 1 against the user's daily Q&A budget (uses `canAskQuestion`)
- Tests: `src/app/api/compare/__tests__/route.test.ts` (6 tests min)
- Commit: `feat(api): add /api/compare route`

### 3. Compare page UI
- `src/app/dashboard/compare/page.tsx`:
  - With `?a=X&b=Y`: render `<CompareView>`
  - Without: render `<ComparePicker>` (two searchable doc dropdowns + "Compare" button)
- `<CompareView>`:
  - Sticky header with both doc titles + "Swap" button
  - Body: vertical list of aligned rows. Each row is two columns (a, b).
    - Matched pair: clauses side-by-side with word-diff highlighting
    - Unmatched A only: clause on left, "Not present in B" placeholder on right
    - Unmatched B only: mirror
  - Filter toggles: "Only show differences" | "Show all"
- Commit: `feat(compare): add /dashboard/compare page + view`

### 4. Document detail entry point
- Add "Compare with…" button in document detail action area (next to Share)
- On click: open a small picker modal listing other documents in portfolio,
  filtered to same `document_type` first. Pick one → navigate to
  `/dashboard/compare?a=<current>&b=<picked>`
- Commit: `feat(compare): add Compare with… action on document detail`

## Tests required

- Align: 4 tests (perfect match, partial, unmatched, threshold)
- Diff: 4 tests (added words, removed words, equal, mixed)
- API: 6 tests (happy, 401, 404 a, 404 b, RLS, mock mode)
- UI: 2 tests (picker renders, swap toggles params)
- Total new tests: ~16

## Definition of done

- `npm test` ✅ all passing
- `npm run lint` ✅ clean
- `npx tsc --noEmit` ✅ clean
- `npx next build` ✅ clean
- All 4 commits pushed to `track-pp-contract-compare`
- PR body QA hook:
  1. Open document A → "Compare with…" → pick document B
  2. See side-by-side with diff highlights
  3. Toggle "Only differences" → equal pairs hide
  4. Click "Swap" → A and B switch sides
- No regressions on document detail or clauses pages
