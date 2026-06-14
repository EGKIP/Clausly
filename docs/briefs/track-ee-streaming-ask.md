# Track EE — Streaming Ask responses

**Owner:** Codex
**Branch:** `track-ee-streaming-ask`
**Base:** `main` AFTER Track FF lands (pull main, then branch)
**Estimated effort:** ~half day
**Pick-up order:** SECOND — after FF is merged

## Goal

Convert the Ask Clausly experience from "wait, then see the whole answer" to
"tokens stream in as the model writes them." Applies to BOTH the single-document
`/api/documents/[id]/ask` and (if FF has landed) `/api/ask/portfolio`.

Server-Sent Events transport. The non-streaming JSON response remains available
for backwards compatibility (tests, scripts, mock mode) — streaming is opt-in via
the request `Accept: text/event-stream` header.

## Non-goals (do NOT touch)
- No WebSockets. SSE only.
- No new persistence. We still write a single `usage_metrics` row at the end of the stream.
- No conversation history. Still single-turn.
- Do NOT change the QA provider's existing non-streaming function signatures — add NEW streaming functions alongside.
- Do NOT change the citation schema. Citations are still emitted once at the start of the stream (after retrieval, before the LLM call).
- No changes to embeddings, chunking, or migrations.

## Architecture

```
STREAMING ASK FLOW (when Accept: text/event-stream):
1. Auth + validate body (same as today)
2. Open the SSE response stream immediately with Content-Type: text/event-stream
3. Embed question + vector search (same as today)
4. Emit `event: citations\ndata: {json}` with the citation cards
5. Call OpenAI Responses API in streaming mode
6. For each token delta, emit `event: token\ndata: {"text": "..."}`
7. When the model finishes, emit `event: done\ndata: {}` and close the stream
8. On error mid-stream: emit `event: error\ndata: {"message": "..."}` and close

Fallback path (no Accept header, or Accept: application/json):
- Existing behavior, single JSON response. No changes to that path.
```

The OpenAI Responses API supports streaming via `stream: true` and emits
`response.output_text.delta` events. We translate those to our SSE frame format
so the client doesn't need to know OpenAI's event names.

## Scope — 5 deliverables

### 1. `src/lib/ai/qa/stream.ts` (new file)
- Export `type QAStreamEvent = { type: "token"; text: string } | { type: "done" } | { type: "error"; message: string };`
- Export `type QAStreamProvider = (input: QAInput) => AsyncIterable<QAStreamEvent>;`
- `getQAStreamProvider(): QAStreamProvider` — returns mock or openai impl based on `CLAUSLY_AI_PROVIDER`
- Mock provider: yields the existing mock answer split by spaces with a tiny delay (10ms per word), then `{ type: "done" }`. For tests, expose an option to skip the delay.
- OpenAI provider: POSTs to `OPENAI_RESPONSES_URL` with `stream: true`, parses the SSE response from OpenAI, yields `{ type: "token", text: delta }` for each `response.output_text.delta` event, ends with `{ type: "done" }`. Errors yield `{ type: "error" }` then end.
- Reuse the system + user prompts from the non-streaming provider — extract them to `src/lib/ai/qa/prompts.ts` if cleaner.

### 2. Update both ask routes to support `Accept: text/event-stream`
- `src/app/api/documents/[id]/ask/route.ts`:
  - At the top of POST, check `request.headers.get("accept")?.includes("text/event-stream")`.
  - If yes, return a `Response` with `ReadableStream` body, `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
  - Inside the stream: same auth, validation, embed, vector search. Then enqueue the citations frame, iterate `getQAStreamProvider()(input)`, enqueue token frames, end with done.
  - On any error before stream opens → JSON 4xx/5xx as today. After stream opens → enqueue an error frame and close.
- `src/app/api/ask/portfolio/route.ts` (if FF has landed): mirror the same change. If FF hasn't landed, skip this and add a note in the PR description.

### 3. Helper `src/lib/ai/qa/sse.ts` (new file)
- `encodeSseFrame(event: string, data: object): Uint8Array` — small utility so the routes don't sprinkle string concatenation.
- One unit test.

### 4. Update `AskPanel` in `src/components/dashboard/document-view.tsx`
- Detect when a fresh question is submitted. Use `fetch` with `Accept: text/event-stream`, read `response.body` as a `ReadableStream`, decode chunks, parse SSE frames.
- Render the accumulating token text in real time (use a local ref + setState pattern, or `useSyncExternalStore` — your call).
- Render the citations card as soon as the `citations` frame arrives, even before the answer is complete.
- On `done`: stop the stream, set final state, focus the input again.
- On `error` frame: render an inline error, keep partial answer text if any was streamed.
- Loading state: while streaming, show a tiny pulse indicator next to the answer. Disable the submit button.
- IMPORTANT: only modify the body of `AskPanel`. No other tabs.

### 5. Mirror UI update in `PortfolioAsk` (if FF has landed)
- Same streaming consumer pattern.
- If FF hasn't landed yet, leave a clear `TODO(track-EE): wire streaming after FF` comment in the route and skip the UI change for portfolio — just do single-doc.

## Tests
- `src/lib/ai/qa/__tests__/stream.test.ts`:
  - Mock streamer yields N token frames + done in order
  - OpenAI streamer parses a fixture SSE response correctly
  - Error event terminates the iterable cleanly
- `src/app/api/documents/[id]/ask/__tests__/route.test.ts`:
  - Add a streaming case: `Accept: text/event-stream` returns 200 with `text/event-stream` content-type, body contains a citations frame + at least one token frame + a done frame
  - Existing JSON-mode tests keep passing unchanged
- `src/lib/ai/qa/__tests__/sse.test.ts`: encoder produces correct wire format
- All existing tests must still pass

## Env vars
None new.

## QA hook (for the PR body)
1. Open any document → Ask tab → ask a question → answer text streams in token-by-token instead of appearing all at once.
2. Network tab shows a `text/event-stream` response with `citations`, `token`, `done` events.
3. Curl test:
   ```
   curl -N -H "Accept: text/event-stream" -H "Authorization: Bearer ..." \
     -X POST https://clausly.app/api/documents/<id>/ask \
     -d '{"question":"What is the termination clause?"}'
   ```
   Should see SSE frames stream to stdout.

## Commit cadence — commit + push after EACH phase
1. `feat(rag): add streaming QA provider + SSE encoder` (deliverables 1, 3 + tests)
2. `feat(rag): support text/event-stream on single-document ask route` (deliverable 2 single-doc + tests)
3. `feat(ui): stream tokens into AskPanel` (deliverable 4)
4. (if FF is merged) `feat(rag): support streaming on portfolio ask route + UI` (deliverables 2/5 portfolio)

Push after each commit. Open the PR after commit 3 (or 4 if FF merged in time).

## Done criteria
- 3–4 commits on `track-ee-streaming-ask` pushed
- `npm test`, `npm run lint`, `npx tsc --noEmit`, `npx next build` all clean
- PR description includes QA hook + a screen recording or GIF showing token-by-token streaming
