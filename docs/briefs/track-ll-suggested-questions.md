# Track LL — Suggested starter questions for Ask Clausly

**Owner:** Codex
**Branch:** `track-ll-suggested-questions`
**Base:** `main` AFTER Track II merges (can land in parallel with JJ since no overlap)
**Estimated effort:** ~half day
**Pick-up order:** THIRD in batch 2 — can be done in parallel with JJ if Codex feels comfortable, otherwise sequential

## Goal

When a user opens the Ask tab on a document for the first time (no prior
conversation in that document), show 3–4 AI-generated suggested questions
specific to that contract. Click a chip → it populates the question input
and fires the existing ask flow. Drastically improves first-time
discoverability for users who don't know what to ask.

Same treatment on the Portfolio Ask panel for users with multiple documents.

## Non-goals (do NOT touch)
- No personalized suggestions based on user history — purely document-specific.
- No editing or favoriting of suggestions.
- No suggestions on the dashboard home page — Ask panels only.
- No caching layer beyond Postgres — keep it simple, regenerate cheaply.
- Do NOT change the existing /ask routes — suggestions are a separate endpoint.
- Do NOT use OpenAI streaming for this — it's a small one-shot JSON call.

## Architecture

```
SINGLE-DOC FLOW:
1. AskPanel renders → check if document has cached suggestions
2. GET /api/documents/[id]/suggested-questions
3. Server: if suggestions cached in last 7 days → return them
4. Otherwise:
   - Load 3-5 highest-similarity chunks for that doc (semantic anchor)
   - Call LLM: "Given these excerpts from a contract, generate 4 short questions a user might ask. Return JSON array of strings, each <= 90 chars."
   - Persist to document_suggestions table (one row per doc)
   - Return { suggestions: string[] }
5. UI renders chips. Click a chip → fills input → submits ask request as today.

PORTFOLIO FLOW:
GET /api/ask/portfolio/suggested-questions
1. Load top N chunks across user's portfolio (existing match_portfolio_chunks RPC, similarity-only — pass a generic anchor embedding)
2. LLM call with same prompt but cross-doc framing
3. Cache in users table column or a small portfolio_suggestions table keyed by user_id

Both flows count toward the existing qa rate limit (job_type='qa_suggest', new value).
```

## Scope — 6 deliverables

### 1. Migration `supabase/migrations/<timestamp>_suggested_questions.sql`
- New table:
  ```sql
  create table public.document_suggestions (
    document_id uuid primary key references public.documents(id) on delete cascade,
    suggestions jsonb not null default '[]'::jsonb,
    generated_at timestamptz not null default now()
  );
  alter table public.document_suggestions enable row level security;
  create policy "owners read suggestions" on public.document_suggestions for select using (
    document_id in (select id from public.documents where user_id = (select auth.uid()))
  );
  ```
- Mirror `portfolio_suggestions(user_id pk, suggestions jsonb, generated_at)` with own RLS.
- Augment applies via Supabase MCP.

### 2. `src/lib/ai/qa/suggest.ts` (new file)
- `generateDocumentSuggestions(chunks: QAChunk[]): Promise<string[]>` — mock + OpenAI variants.
- Mock returns 4 canned starter questions like "What's the termination clause?", "When does this auto-renew?", etc.
- OpenAI calls Responses API with `json_object` format, schema validates array of 4 strings.
- Reuses `getQAModel()` and `getQAProviderName()` from existing provider.

### 3. `GET /api/documents/[id]/suggested-questions` (new route)
- Auth required.
- Check `document_suggestions.generated_at > now() - interval '7 days'` → return cached.
- Otherwise vector search to grab top 5 chunks for that doc (use a generic anchor like "key terms, dates, obligations" embedding, or pull chunks by `chunk_index` for the first few).
- Call `generateDocumentSuggestions`, persist, return.
- Counts toward Q&A rate limit as `qa_suggest` (cheap but still LLM call).
- Demo mode returns canned suggestions, skips DB.

### 4. `GET /api/ask/portfolio/suggested-questions` (new route)
- Same structure but Pro-gated (call `canAccessInsights` first → 403 with `code: 'INSIGHTS_REQUIRED'` for free users).
- Uses `match_portfolio_chunks` with a generic anchor.
- Persists to `portfolio_suggestions` table.

### 5. UI updates
- `src/components/dashboard/document-view.tsx` AskPanel:
  - On mount (when no conversation selected, no question typed), fetch suggestions
  - Render 4 small pill buttons above the question input: "Try one of these →"
  - Click → setQuestion(text) → submit
  - Hide chips after the first question is sent
- `src/components/dashboard/portfolio-ask.tsx`: same treatment

### 6. Add `qa_suggest` to the rate-limit job_type union
- Update `src/lib/billing/qa-rate-limit.ts`: add `'qa_suggest'` to `QA_JOB_TYPES`.
- Bump existing tests accordingly (counts include suggest calls).

## Tests
- `src/lib/ai/qa/__tests__/suggest.test.ts`: mock returns 4 canned, openai returns parsed JSON, schema rejects non-array, schema rejects > 90 char items
- `src/app/api/documents/[id]/suggested-questions/__tests__/route.test.ts`: 401, 404 wrong user, 200 happy path (with cache hit + cache miss), 429 when rate-limited
- `src/app/api/ask/portfolio/suggested-questions/__tests__/route.test.ts`: 401, 403 free user, 200 Pro user
- All existing tests pass

## Env vars
None new.

## QA hook (for PR body)
1. Upload a contract → wait for indexing
2. Open Ask tab → see 4 doc-specific suggested questions ("What's the termination clause?", "When does this auto-renew?", etc.)
3. Click one → it fills the input and submits → answer streams in
4. Refresh page → suggestions still there (cached)
5. Sign in as Pro user → Insights → Portfolio Ask → see portfolio-wide suggestions

## Commit cadence — commit + push after EACH phase
1. `feat(db): add document_suggestions + portfolio_suggestions tables`
2. `feat(rag): add suggest helper + single-doc suggestions endpoint`
3. `feat(rag): add portfolio suggestions endpoint`
4. `feat(ui): render suggested question chips in AskPanel + PortfolioAsk`

Push after each. Open PR after commit 4.

## Done criteria
- 4 commits pushed
- `npm test`, `npm run lint`, `npx tsc --noEmit`, `npx next build` all clean
- PR body includes QA hook + screenshot of suggestion chips
- Migration file exists but not applied (Augment applies via MCP)
