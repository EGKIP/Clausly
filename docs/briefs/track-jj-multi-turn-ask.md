# Track JJ — Multi-turn Ask Clausly conversations

**Owner:** Codex
**Branch:** `track-jj-multi-turn-ask`
**Base:** `main` AFTER Track II merges (we want clean ordering, no rebase pain)
**Estimated effort:** ~1 day
**Pick-up order:** SECOND in batch 2

## Goal

Ask Clausly remembers previous turns within a conversation. User can ask
"what's the termination clause?" then follow up with "and what's the notice
period for that?" without re-typing context. Works on both single-document
and portfolio Ask. Streaming and rate limiting from Tracks EE + HH stay intact.

## Non-goals (do NOT touch)
- No conversation editing (rename/delete) — leave the rows immutable except for `updated_at`.
- No branching conversations.
- No sharing conversations with other users.
- No conversation search.
- Do NOT touch the existing chunk retrieval logic — multi-turn just adds prior messages to the LLM prompt context.
- Do NOT touch the rate-limit logic — each new question still counts as one `qa_question` (or `qa_portfolio`) regardless of conversation length.
- Do NOT change the SSE wire format — same `citations` / `token` / `done` events. We add a new `conversation` event at the start of fresh conversations only.

## Architecture

```
NEW DATA MODEL:
  qa_conversations (id, user_id, document_id NULL, title, created_at, updated_at)
  qa_messages (id, conversation_id, role, content, citations jsonb, created_at)
     role IN ('user','assistant')

REQUEST FLOW:
1. Client POSTs to /api/documents/[id]/ask or /api/ask/portfolio
2. Body now includes optional `conversationId`
3. If conversationId is missing → create a new conversation (title = truncated first question)
4. Insert the user message
5. Load prior N=10 messages (or all if fewer) for that conversation, in order
6. Build LLM prompt: system → prior messages → current question + excerpts
7. Stream/return answer as today
8. Insert the assistant message with citations
9. If new conversation, emit `conversation` SSE event with { id, title } so client can persist locally

UI:
- AskPanel + PortfolioAsk get a small "Conversations" sidebar/dropdown:
  - "+ New chat" button (resets local conversationId to null)
  - Last 10 conversations for that document (or portfolio), click to load
- Messages render as a chat thread (user bubbles + assistant bubbles)
```

## Scope — 6 deliverables

### 1. Migration `supabase/migrations/<timestamp>_qa_conversations.sql`
- New tables `qa_conversations` and `qa_messages` (schemas in the architecture above)
- RLS policies: user can read/insert/update only their own conversations + messages
- Index `qa_messages(conversation_id, created_at)` for fast prior-message loading
- Augment applies via Supabase MCP after PR review.

### 2. `src/lib/db/conversations.ts` (new file)
- `getOrCreateConversation(supabase, userId, documentId, firstQuestion): Promise<{ id; title; isNew }>`
- `loadConversationMessages(supabase, userId, conversationId, limit=10): Promise<Message[]>`
- `appendMessage(supabase, conversationId, role, content, citations)`
- `listConversations(supabase, userId, documentId?: string, limit=10): Promise<ConversationSummary[]>`

### 3. Update both ask routes
- Extend `questionSchema` to include `conversationId: z.string().uuid().optional()`.
- Single-doc route: only loads conversations for that `documentId`.
- Portfolio route: conversations have `document_id IS NULL`.
- Build the LLM messages array with prior history (still under the existing 60s timeout).
- Streaming path: emit `event: conversation\ndata: {id, title}` BEFORE the citations frame if `isNew` is true.
- Non-streaming JSON path: include `conversation: { id, title, isNew }` in the JSON response.

### 4. New endpoints
- `GET /api/conversations?documentId=<id>&limit=10` — returns recent conversations, scoped by current user (and document if given, else portfolio-only)
- `GET /api/conversations/[id]/messages` — returns full message list for one conversation, with 404 on missing/unauthorized.

### 5. UI updates
- `src/components/dashboard/document-view.tsx` AskPanel:
  - On mount, fetch `/api/conversations?documentId=<id>` → render in a side dropdown
  - When user submits a question, send `conversationId` if one is selected
  - On `conversation` SSE event for a new chat, store the id locally + add to dropdown
  - On `+ New chat`, clear local `conversationId` and message list
  - Render messages as a thread (newest at bottom), keep streaming-token rendering on the last assistant message
- `src/components/dashboard/portfolio-ask.tsx`: same treatment with `documentId=null` filter (portfolio-only conversations)

### 6. Prompt updates
- Update `src/lib/ai/qa/prompts.ts`:
  - System prompt grows by one line: "You may reference prior turns in the conversation when relevant, but always ground answers in the provided excerpts."
  - Add a new helper `qaUserPromptWithHistory(input: QAInput & { history: Message[] }): string` — folds history into the prompt
- Streaming provider: pass history through

## Tests
- `src/lib/db/__tests__/conversations.test.ts`: getOrCreate creates + reuses; history loads in order; appendMessage works
- `src/app/api/conversations/__tests__/route.test.ts`: 401, scoped to user, limit honored
- `src/app/api/conversations/[id]/messages/__tests__/route.test.ts`: 401, 404 wrong user, 200 happy path
- Update single-doc + portfolio ask route tests: add a multi-turn case (2 questions in same conversation → 2nd question receives history)
- All 208 existing tests must still pass

## Env vars
None new.

## QA hook (for PR body)
1. Open a document → Ask: "What's the termination clause?"
2. Wait for streamed answer + citation
3. Follow up: "And what's the notice period for that?"
4. Assistant answers contextually, citing the same termination section
5. Click "+ New chat" → ask different question → no carry-over
6. Refresh page → conversation list still has both chats, click to reload history
7. Repeat on Insights → Portfolio Ask

## Commit cadence — commit + push after EACH phase
1. `feat(db): add qa_conversations + qa_messages tables and helpers`
2. `feat(rag): support multi-turn context in single-doc + portfolio ask routes`
3. `feat(api): add GET /api/conversations endpoints`
4. `feat(ui): render conversation threads + recent chats in AskPanel + PortfolioAsk`

Push after each. Open PR after commit 4.

## Done criteria
- 4 commits pushed
- `npm test`, `npm run lint`, `npx tsc --noEmit`, `npx next build` all clean
- PR body includes QA hook + screenshot of a multi-turn conversation
- Migration file exists but not applied (Augment applies via MCP)
