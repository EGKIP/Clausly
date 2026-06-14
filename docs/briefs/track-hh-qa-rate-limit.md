# Track HH — Q&A rate limiting

**Owner:** Codex
**Branch:** `track-hh-qa-rate-limit`
**Base:** `main` AFTER Tracks FF and EE land
**Estimated effort:** ~2–3 hours
**Pick-up order:** THIRD — depends on FF (portfolio ask route exists) and EE (streaming routes)

## Goal

Cap Q&A calls per user per rolling 24-hour window. RAG queries hit OpenAI for
both embedding + answer, so unbounded usage = real money. Cap is plan-aware:
Free gets a small allowance, Pro a generous one. Both single-doc Ask and
Portfolio Ask share the same counter.

Failure-mode is friendly: a 429 response with the count, the limit, and the
reset timestamp. UI shows remaining quota.

## Non-goals (do NOT touch)
- No Stripe metering, no overage charges. Just hard count caps.
- No per-document quotas — only per-user.
- No rate-limit storage in Redis or external KV. Use Postgres (the existing `usage_metrics` table is enough to derive counts).
- Do NOT change billing logic or plan definitions in `src/lib/billing/limits.ts` (we ADD new fields, not modify existing ones).
- No background cleanup jobs. Rows in `usage_metrics` are tiny and we already have an index on `(user_id, created_at)`.

## Architecture

```
RATE LIMIT FLOW (executes inside both ask routes, BEFORE the embed/LLM call):
1. Read user's plan via getUserPlan(supabase, userId)
2. Look up PLAN_LIMITS[plan].qaPerDay
3. Count rows in usage_metrics WHERE user_id = $1 AND job_type IN ('qa_question','qa_portfolio') AND created_at > now() - interval '24 hours'
4. If count >= limit, return 429 { error, code: 'QA_RATE_LIMIT', limit, used: count, resetsAt: ISO }
5. Otherwise proceed with the existing flow

The existing usage_metrics insert at the END of the request becomes the counter
increment. No new table, no race conditions worth worrying about — even if two
requests slip in at the boundary, the cap is "approximately N", which is fine.
```

## Scope — 6 deliverables

### 1. Extend `src/lib/billing/limits.ts`
- Add `qaPerDay` to each plan:
  - `free: { ..., qaPerDay: 25 }`
  - `pro:  { ..., qaPerDay: 250 }`
- Do NOT remove or rename existing fields. Add only.

### 2. `src/lib/billing/qa-rate-limit.ts` (new file)
- `getQaUsage(supabase, userId): Promise<{ used: number; limit: number; remaining: number; plan: PlanName; resetsAt: string }>`
  - Calls `getUserPlan(supabase, userId)` to get the plan
  - `supabase.from("usage_metrics").select("id", { count: "exact", head: true }).eq("user_id", userId).in("job_type", ["qa_question", "qa_portfolio"]).gte("created_at", twentyFourHoursAgoISO)`
  - `resetsAt` = ISO timestamp of the OLDEST row in the window (call a second query with `.order("created_at", { ascending: true }).limit(1)`) + 24h. If no rows yet, resetsAt = `now + 24h`.
  - Returns `{ used, limit, remaining: Math.max(limit - used, 0), plan, resetsAt }`
- `canAskQuestion(supabase, userId): Promise<{ allowed: boolean } & ReturnType-of-getQaUsage>`
  - Wraps `getQaUsage` and adds `allowed: remaining > 0`
- Pure server-side, mirror the style of `src/lib/billing/plan.ts`.

### 3. Wire into ask routes
- At the top of each route, after auth + body validation but BEFORE the embed call:
  ```ts
  const gate = await canAskQuestion(supabase, user.id);
  if (!gate.allowed) {
    return NextResponse.json({
      error: `You've reached your ${gate.limit}-question daily limit on the ${gate.plan} plan.`,
      code: "QA_RATE_LIMIT",
      limit: gate.limit,
      used: gate.used,
      resetsAt: gate.resetsAt,
      plan: gate.plan,
    }, { status: 429 });
  }
  ```
- Apply identically to `src/app/api/documents/[id]/ask/route.ts` and `src/app/api/ask/portfolio/route.ts`.
- Place the check BEFORE the streaming branch in route — we want to 429 with JSON, not open an SSE stream just to error.

### 4. Surface remaining quota in UI
- New GET endpoint `src/app/api/ask/usage/route.ts`:
  - Returns `getQaUsage(supabase, user.id)` shape (200 with JSON; 401 if no session).
- In `AskPanel` and `PortfolioAsk`:
  - On mount, fetch `/api/ask/usage`.
  - Render a small `~14px` muted line below the input: `"23 of 25 questions remaining today"` (or similar).
  - On successful ask, decrement locally by 1 (avoid a re-fetch round-trip).
  - On 429 response, parse the body, show an inline error: `"You've used all 25 questions for today. Resets {relativeTime}."` plus an upgrade CTA for free users.

### 5. Tests
- `src/lib/billing/__tests__/qa-rate-limit.test.ts`:
  - Free plan, 0 used → allowed, remaining = 25
  - Free plan, 25 used → not allowed, remaining = 0
  - Pro plan, 100 used → allowed, remaining = 150
  - resetsAt is "now + 24h" when no rows exist
  - resetsAt is "oldest row + 24h" when window has rows
- `src/app/api/documents/[id]/ask/__tests__/route.test.ts`:
  - Add a 429 case: pre-seed 25 `qa_question` usage_metrics rows for free user, expect 429 with the documented body shape
- `src/app/api/ask/portfolio/__tests__/route.test.ts`: same 429 case
- `src/app/api/ask/usage/__tests__/route.test.ts`: 401 no session, 200 happy path
- All existing tests must still pass

### 6. Update existing test helpers if needed
- `tests/helpers/supabase.ts`: if missing, add a `seedUsageMetric(user, { jobType, createdAt })` helper. Reuse for the new tests.

## Env vars
None new.

## QA hook (for the PR body)
1. As a free user, ask 25 questions across single-doc + portfolio (any mix).
2. The 26th attempt returns 429 with `code: QA_RATE_LIMIT`.
3. AskPanel shows "0 of 25 questions remaining today" with a reset timestamp.
4. Switch to Pro (via DB update), refresh, panel shows "~225 of 250 remaining".
5. SQL spot-check:
   ```sql
   select count(*) from public.usage_metrics
   where user_id = '<id>' and job_type in ('qa_question','qa_portfolio')
   and created_at > now() - interval '24 hours';
   ```

## Commit cadence — commit + push after EACH phase
1. `feat(billing): add qaPerDay plan limits + qa-rate-limit helper` (deliverables 1, 2 + tests)
2. `feat(rag): enforce daily Q&A rate limit on ask routes` (deliverable 3 + 429 route tests)
3. `feat(ui): surface remaining Q&A quota in AskPanel + PortfolioAsk` (deliverable 4 + usage endpoint)

Push after each commit. Open the PR after commit 3.

## Done criteria
- 3 commits on `track-hh-qa-rate-limit` pushed
- `npm test`, `npm run lint`, `npx tsc --noEmit`, `npx next build` all clean
- PR description includes QA hook + screenshot of the "X of Y remaining" line + a 429 response screenshot
