# Track CC — Ask Clausly (Document Q&A via RAG)

**Owner:** Codex
**Branch:** `track-cc-ask-clausly`
**Base:** `main` at `12c7eb2`
**Estimated effort:** full day

## Goal

Replace the static example `AskPanel` on the document detail page with a real
retrieval-augmented Q&A endpoint. User asks a free-form question about ONE
specific document. We embed the question, vector-search that document's chunks,
build a grounded prompt, call the LLM, and return an answer + clause/page
citations.

Single-document, single-turn, non-streaming. Conversation history, multi-doc
Q&A, and streaming responses are out of scope for this track.

## Non-goals (do NOT touch)
- No streaming SSE responses (one-shot JSON return is fine).
- No conversation history table — single-turn only.
- No cross-document Q&A — query is always scoped to one `documentId`.
- No new Stripe code or plan gating beyond what Track AA already enforces (Free users still get Q&A; we can paywall a per-day question count in a future track).
- Do NOT touch `src/lib/billing/*`, `src/app/upgrade/*`, or anything in the settings page.
- In `src/components/dashboard/document-view.tsx`, only replace the body of `AskPanel` (lines 348-396) — leave all other tabs and styling alone (Augment is polishing those in a parallel track).

## Architecture

Mirror the existing analyze pipeline patterns. New shape:

```
documents (existing)
  └── document_chunks (NEW: id, document_id, user_id, chunk_index, content, page_number?, embedding vector(1536))

ASK FLOW:
1. POST /api/documents/[id]/ask { question }
2. Verify ownership (RLS + explicit user_id filter, both, like other routes)
3. Embed question via embeddingProvider
4. SELECT top-K chunks from document_chunks WHERE document_id = $1 ORDER BY embedding <=> query_embedding LIMIT 5
5. Build grounded prompt with the K chunks
6. answerProvider({ question, chunks }) -> { answer, citationChunkIds[] }
7. Return { answer, citations: [{ chunkId, pageNumber, snippet }] }

INDEXING FLOW (runs after persistAnalysis succeeds):
1. chunkDocumentText(fullText, { maxTokens: 500, overlap: 50 }) -> chunks[]
2. embedBatch(chunks.map(c => c.content)) -> vectors[]
3. Bulk insert into document_chunks
4. If indexing fails, do NOT fail the analyze run — log warning, continue. Q&A simply unavailable until reanalyze.
```

## Scope — 9 deliverables

### 1. Migration `supabase/migrations/20260613000100_document_chunks_rag.sql`
- `create extension if not exists vector;`
- Table `document_chunks` with columns: `id uuid PK default gen_random_uuid()`, `document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE`, `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `chunk_index int NOT NULL`, `content text NOT NULL`, `page_number int`, `embedding vector(1536)`, `created_at timestamptz NOT NULL DEFAULT now()`.
- Unique index on `(document_id, chunk_index)`.
- ivfflat index on embedding using `vector_cosine_ops` with `lists = 100`.
- RLS enabled. Policies: `select using (user_id = auth.uid())`, `insert/update/delete with check (user_id = auth.uid())`. Plus a service-role bypass for the indexing pipeline (use existing service-role helper, not direct).
- Grants matching existing migrations.

### 2. `src/lib/ai/chunking.ts`
Pure text-chunking helper. No external deps.
- `chunkDocumentText(text: string, options?: { maxChars?: number; overlapChars?: number }): Array<{ index: number; content: string; pageNumber?: number }>`
- Default `maxChars: 2000`, `overlapChars: 200`. Char-based is fine for v1 (we can swap to true token counting later).
- Tries to split on paragraph boundaries (`\n\n`) first, then sentence boundaries, then hard char cut as fallback. Never produces empty chunks.
- If the source text contains `\f` (form feed) page breaks (which `extractPdfText` already emits), track current page and attach `pageNumber` to each chunk.

### 3. `src/lib/ai/embeddings/provider.ts`
- `type EmbeddingProvider = (texts: string[]) => Promise<number[][]>;`
- `type EmbeddingProviderName = "mock" | "openai";`
- `getEmbeddingProvider()` reads `CLAUSLY_EMBEDDING_PROVIDER` (default: same as `CLAUSLY_AI_PROVIDER`, fallback `mock`).
- `getEmbeddingModel()` reads `CLAUSLY_EMBEDDING_MODEL` (default `text-embedding-3-small`, dim 1536).
- Mock provider: deterministic 1536-dim vector derived from text hash (for tests).
- OpenAI provider: batches into one API call, returns vectors aligned to input order.

### 4. `src/lib/ai/embeddings/index.ts`
- `embedDocumentChunks(supabase, documentId, userId, fullText): Promise<{ indexed: number }>`
- Chunks the text, embeds in batches (max 100 per request), bulk inserts into `document_chunks`. Idempotent: deletes existing chunks for the document first, then inserts fresh.
- Errors logged + counted, never thrown to the caller of `runAnalysis`.

### 5. Wire into `src/lib/ai/run-analysis.ts`
- After `persistAnalysis` succeeds and status is set to `ready`, call `embedDocumentChunks` in a fire-and-forget pattern: `void embedDocumentChunks(...).catch(error => console.warn(...))`.
- Document `ready` status is independent of chunking — Q&A endpoint will return a clear "Document is still being indexed, try again in a moment" 409 response if chunks are empty.

### 6. `src/lib/ai/qa/provider.ts`
- `type QAProvider = (input: { question: string; chunks: Array<{ id: string; content: string; pageNumber?: number }> }) => Promise<{ answer: string; citationChunkIds: string[] }>;`
- Mock provider: returns a deterministic stub answer citing the first chunk (for tests).
- OpenAI provider: gpt-4o-mini with structured output (zod schema). System prompt: "You answer questions about ONE contract document using ONLY the provided excerpts. Cite the excerpt IDs you used. If the excerpts don't contain the answer, say so." Reuse the structured-output retry pattern from the analyze providers.

### 7. POST `src/app/api/documents/[id]/ask/route.ts`
- Auth: 401 if no session.
- Verify ownership: select document where `id = $1 and user_id = auth.uid()`. 404 if missing.
- Validate body with zod: `{ question: string min(3) max(500) }`. 400 on validation failure.
- Check document status: if not `ready`, return 409 `{ error: "Document is not ready yet.", code: "DOC_NOT_READY" }`.
- Embed the question.
- Vector search (Supabase rpc or raw `.from("document_chunks").select(...).order(...)` — pick the cleanest option). Top K = 5.
- If 0 chunks found, return 409 `{ error: "Document text is still being indexed, try again shortly.", code: "DOC_NOT_INDEXED" }`.
- Call QA provider. Return `{ answer, citations: [{ chunkId, pageNumber, snippet }] }` where snippet is the first 200 chars of the chunk.
- Track usage: insert into `usage_metrics` with `kind: 'qa_question'` (same table the analyze pipeline writes to).
- Mock mode (`!hasSupabaseEnv()`): return a canned response so the UI can be developed without infra.

### 8. Rewrite `AskPanel` in `src/components/dashboard/document-view.tsx`
- Replace the static body with a real client-side form.
- State: `question`, `loading`, `error`, `result` (answer + citations).
- On submit: POST to `/api/documents/${doc.id}/ask`.
- Render answer text + citation cards below. Each citation card shows page number + snippet, clicking it could in future scroll the PDF — for now just a visual marker.
- Suggested questions: keep as hard-coded list for v1 (4 questions). Clicking a suggestion populates the input.
- Loading state: subtle spinner inline with the send button + skeleton answer area.
- 409 `DOC_NOT_INDEXED` / `DOC_NOT_READY`: show a friendly inline message with a "Try again" button.
- Match the existing editorial voice and use the design tokens already in the file (`var(--surface)`, `var(--accent-ink)`, etc.).
- IMPORTANT: Only modify the body of `AskPanel`. Do not change the tab system, other tabs, or any other section of `document-view.tsx`.

### 9. Backfill helper (admin-only)
- `src/app/api/admin/backfill-chunks/route.ts` POST, gated by `CLAUSLY_ADMIN_SECRET` env var via `Authorization: Bearer ...`.
- Iterates all documents with `status='ready'` that have zero rows in `document_chunks`, calls `embedDocumentChunks` for each.
- Logs progress. Returns `{ processed, failed }`.
- Not linked from UI. Run manually after deploy to backfill existing prod documents.

## Tests

- `src/lib/ai/__tests__/chunking.test.ts` — paragraph/sentence/hard-cut behavior, overlap respected, page number propagation from `\f`, empty input returns empty array.
- `src/lib/ai/embeddings/__tests__/embeddings.test.ts` — mock provider deterministic, batch size capped, idempotent re-index, error path doesn't throw.
- `src/app/api/documents/[id]/ask/__tests__/route.test.ts` — 401 no session, 404 wrong tenant, 400 bad body, 409 not ready, 409 not indexed, 200 happy path with citations, usage_metrics row written.
- Extend `tests/helpers/supabase.ts` if needed to support `document_chunks` seeding + a stub vector search response.
- All existing 165 tests must still pass.

## Env vars (add to `.env.local.example`)

```
# Embeddings (defaults to CLAUSLY_AI_PROVIDER)
CLAUSLY_EMBEDDING_PROVIDER=openai
CLAUSLY_EMBEDDING_MODEL=text-embedding-3-small

# Admin
CLAUSLY_ADMIN_SECRET=
```

## QA hook for the user

After migration applies in `clausly-prod` and a deploy ships:
1. POST `/api/admin/backfill-chunks` with the admin secret to index existing docs.
2. Open any document detail page → Ask tab → type "What's the termination clause?" → expect a grounded answer + at least one citation.

Document this in the PR body.

## Commit cadence — commit + push after EACH phase

1. `feat(rag): add document_chunks migration with pgvector` (deliverable 1)
2. `feat(rag): add document text chunking helper` (deliverable 2 + chunking.test.ts)
3. `feat(rag): add embedding provider abstraction + indexing pipeline` (deliverables 3, 4 + embeddings.test.ts)
4. `feat(rag): wire indexing into analyze pipeline` (deliverable 5)
5. `feat(rag): add QA provider abstraction` (deliverable 6)
6. `feat(rag): add ask endpoint for single-document Q&A` (deliverable 7 + route.test.ts)
7. `feat(ui): wire AskPanel to real /ask endpoint with citations` (deliverable 8)
8. `feat(rag): add admin backfill endpoint for existing documents` (deliverable 9)

Push branch after each commit. Open the PR after commit 8 with the QA hook + a screenshot of a real Ask answer.

## Done criteria
- 8 commits on `track-cc-ask-clausly` pushed
- `npm test` 165 existing + new tests passing
- `npm run lint`, `npx tsc --noEmit`, `npx next build` all clean
- Migration applies cleanly to a fresh local Supabase
- PR description includes the QA hook + screenshot
