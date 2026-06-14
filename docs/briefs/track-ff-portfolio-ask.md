# Track FF — Portfolio-level Ask (cross-document Q&A)

**Owner:** Codex
**Branch:** `track-ff-portfolio-ask`
**Base:** `main` at the latest commit when you cut the branch
**Estimated effort:** ~1 day
**Pick-up order:** FIRST — most isolated, lowest merge-conflict risk

## Goal

A new feature that lets users ask one free-form question across **every document
they've uploaded**, not just one. Returns a grounded answer with citations that
reference multiple documents (each citation links back to its document detail
page). Surfaces in the Insights page as a new panel above the existing Pro
content.

Single-turn. Non-streaming (streaming arrives in Track EE). Free-plan gated to
a sane daily count via Track HH (which lands after this one).

## Non-goals (do NOT touch)
- No streaming — return one JSON payload like the existing single-doc `/ask`.
- No conversation history.
- Do NOT touch `src/app/api/documents/[id]/ask/route.ts` — that one stays unchanged.
- Do NOT touch the AskPanel in `document-view.tsx` — Portfolio Ask is a NEW UI surface.
- No new billing logic. Plan gating is Track HH's job.
- No changes to existing migrations, embeddings, or chunking helpers.

## Architecture

```
PORTFOLIO ASK FLOW:
1. POST /api/ask/portfolio { question }
2. Auth (401 if no session)
3. Validate body (zod, same as /ask)
4. Embed question via existing getEmbeddingProvider()
5. RPC match_portfolio_chunks(query_embedding, match_count=12, per_doc_cap=3)
   - Searches ALL chunks for the current user (RLS enforces user scope)
   - Returns top-N with per-document cap so one big doc doesn't drown others
6. If 0 results → 409 { code: "PORTFOLIO_EMPTY", message: "Upload a document first." }
7. Group chunks by document, fetch document titles for citation rendering
8. Call QA provider (reuse getQAProvider) with multi-doc system prompt
9. Return { answer, citations: [{ documentId, documentTitle, chunkId, pageNumber, snippet }] }
10. Insert usage_metrics row with job_type='qa_portfolio'
```

## Scope — 7 deliverables

### 1. Migration `supabase/migrations/<YYYYMMDDHHMMSS>_portfolio_ask_rpc.sql`
- Create RPC `public.match_portfolio_chunks(query_embedding vector(1536), match_count int default 12, per_doc_cap int default 3)`
- `stable`, `language sql`
- Scopes to `auth.uid()` via the existing `document_chunks.user_id` filter
- Returns `(id, document_id, user_id, chunk_index, content, page_number, similarity)`
- Uses a windowed `row_number() over (partition by document_id order by embedding <=> query_embedding)` to cap per-document results to `per_doc_cap`, then orders by similarity across all eligible rows
- Grant execute to `authenticated`

### 2. `src/lib/ai/qa/portfolio-provider.ts` (new file)
- Same `QAProvider` shape but the system prompt knows it's reasoning over MULTIPLE documents
- Each chunk in the user prompt is prefixed with its document title for grounding
- Reuse `OPENAI_RESPONSES_URL`, the timeout/retry helper, and the zod result schema by extracting them to a shared `src/lib/ai/qa/shared.ts` IF the duplication bothers you — otherwise copy carefully
- Mock provider: cites the first chunk and includes its document title in the answer
- Export `getPortfolioQAProvider(): QAProvider`

### 3. `src/app/api/ask/portfolio/route.ts` POST
- Auth: 401 if no session
- Validate `{ question: string min(3) max(500) }`
- Embed question with `getEmbeddingProvider()`
- Call `supabase.rpc("match_portfolio_chunks", { query_embedding, match_count: 12, per_doc_cap: 3 })`
- If empty → 409 `{ error, code: "PORTFOLIO_EMPTY" }`
- Look up document titles in a single `from("documents").select("id, title").in("id", uniqueDocIds)` query
- Call `getPortfolioQAProvider()({ question, chunks })` — chunks include `documentTitle` so the prompt is grounded
- Build citations grouped by document with snippets (first 200 chars)
- Insert usage_metrics with `job_type='qa_portfolio'`, `document_id: null`
- Mock mode (no Supabase env): canned demo response with two fake doc citations

### 4. `src/components/dashboard/portfolio-ask.tsx` (new file)
- Client component, mirrors the existing AskPanel style (`var(--surface)`, `var(--accent-ink)`, etc.)
- Header: "Ask your portfolio" with a one-line subtitle
- Textarea + submit button
- 4 suggested questions (hard-coded for v1): e.g. "Which contracts expire in the next 90 days?", "Which of my leases have auto-renewal clauses?", "Where is my highest monthly cost?", "Do any of my contracts have indemnity?"
- Citation cards: each shows the document title (as a `<Link>` to `/dashboard/documents/{id}`), page number, and snippet
- Loading + error states match `AskPanel`
- Handles 409 `PORTFOLIO_EMPTY` with a friendly "Upload your first document to use Portfolio Ask" message + link to documents page

### 5. Wire into Insights page
- In `src/app/dashboard/insights/page.tsx`, render `<PortfolioAsk />` at the TOP of the page (above existing insights content) — only when the user is on Pro (use existing `canAccessInsights` check). Free users see an "Upgrade to unlock Portfolio Ask" teaser card with the same shape (reuse `InsightsUpgradeCard` styling).
- Don't break the existing insights gating logic.

### 6. Tests
- `supabase/migrations/__tests__` is not a thing here — verify the RPC exists by writing a route test that mocks rpc and asserts call args
- `src/app/api/ask/portfolio/__tests__/route.test.ts`:
  - 401 no session
  - 400 bad body
  - 409 empty portfolio
  - 200 happy path returns answer + citations grouped by doc + usage_metrics insert
  - Verifies per_doc_cap is sent to the RPC (12, 3)
- `src/lib/ai/qa/__tests__/portfolio-provider.test.ts`:
  - Mock provider behaviour
  - Schema validation retry path mirrors single-doc tests
- All existing 185+ tests must still pass

### 7. Update `docs/briefs/track-ff-portfolio-ask.md` "Done" section
- Add a "Verification" subsection with the curl command + a SQL snippet to confirm the RPC works

## Env vars
None new. Reuses `CLAUSLY_AI_PROVIDER`, `OPENAI_API_KEY`, `CLAUSLY_EMBEDDING_*`.

## QA hook (for the PR body)
1. Apply migration to `clausly-prod` (Augment will handle via Supabase MCP).
2. Open `/dashboard/insights` as a Pro user → Portfolio Ask panel renders.
3. Ask "Which contracts expire soonest?" → answer cites 2+ documents.
4. Click a citation → navigates to that document's detail page.

## Commit cadence — commit + push after EACH phase
1. `feat(rag): add match_portfolio_chunks RPC migration`
2. `feat(rag): add portfolio QA provider abstraction` (+ tests)
3. `feat(rag): add /api/ask/portfolio endpoint` (+ route tests)
4. `feat(ui): add PortfolioAsk panel + wire into Insights page`

Push branch after each commit. Open the PR after commit 4.

## Done criteria
- 4 commits on `track-ff-portfolio-ask` pushed
- `npm test`, `npm run lint`, `npx tsc --noEmit`, `npx next build` all clean
- Migration applies cleanly to a fresh local Supabase
- PR description includes QA hook + screenshot of Portfolio Ask answering with multi-doc citations
