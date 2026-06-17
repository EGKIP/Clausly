# Track MM — Interactive onboarding tour

## Goal

First-time users get a guided 4-step tour the moment they land in the
dashboard: **upload → analysis → clauses → approve reminder**. The tour
runs as a dismissible overlay, persists completion server-side, and uses
the existing demo-seed contracts so new users always have something to
click on.

## Non-goals

- Not redesigning `/dashboard/welcome` editorial page (steps 1–3 stay).
- Not changing how analysis runs, clauses are extracted, or reminders fire.
- Not adding video / animation walkthroughs.
- Not gating any feature behind tour completion.

## Architecture

| File | Purpose |
|---|---|
| `supabase/migrations/20260618000100_onboarding_tour.sql` | Add `onboarding_tour_completed_at timestamptz` column to `public.users` |
| `src/lib/db/onboarding-tour.ts` | `markTourComplete(supabase, userId)` + `getTourState(supabase, userId)` |
| `src/app/api/onboarding/tour/route.ts` | `POST` marks complete, `GET` returns state |
| `src/components/onboarding/tour-overlay.tsx` | Client component, 4 coachmark steps, dismissible, persists on completion |
| `src/components/onboarding/tour-step.tsx` | Single step UI (highlight + tooltip + Next button) |
| `src/app/dashboard/layout.tsx` | Mount the tour if `tourCompletedAt == null` AND user has at least 1 doc |

## Commit cadence (CRITICAL)

**Commit and push after EACH numbered deliverable below.** Do not bundle
multiple deliverables in one commit. Each commit must build + lint + test
clean. Use Conventional Commits.

## Deliverables

### 1. DB migration + helpers + types
- Write `supabase/migrations/20260618000100_onboarding_tour.sql` (do NOT apply)
- Add `onboarding_tour_completed_at` to `src/lib/supabase/types.ts` on `users`
- Write `src/lib/db/onboarding-tour.ts`
- Tests: `src/lib/db/__tests__/onboarding-tour.test.ts` (3 tests min)
- Commit: `feat(db): add onboarding_tour_completed_at column + helpers`

### 2. API route
- `src/app/api/onboarding/tour/route.ts` — `GET` returns `{completedAt}`, `POST` sets timestamp
- Mock mode (`!hasSupabaseEnv()`): GET returns `{completedAt: null}`, POST returns 200
- Auth: 401 if no user
- Tests: `src/app/api/onboarding/tour/__tests__/route.test.ts` (4 tests min)
- Commit: `feat(api): add /api/onboarding/tour GET/POST`

### 3. Tour overlay component
- Build `tour-overlay.tsx` + `tour-step.tsx`
- 4 steps with `data-tour="upload" | "documents" | "clauses" | "reminders"`
- Each step: spotlight (dim background, ring on target), tooltip card (title,
  body, "Next" / "Skip"), arrow pointing to target
- On final step or skip: call `POST /api/onboarding/tour`
- Respects `prefers-reduced-motion`
- Tests via testing-library: render, click Next advances, Skip closes, completion fires POST
- Commit: `feat(onboarding): add interactive tour overlay component`

### 4. Wire into dashboard
- In `src/app/dashboard/layout.tsx` (or nearest server component): fetch tour state +
  document count. If `completedAt == null` AND `docs >= 1`, mount `<TourOverlay />`
- Add `data-tour="*"` attrs to targets on dashboard home, documents list,
  document detail (Clauses tab), reminders page
- Make sure existing demo-seed docs trigger this (so brand-new users with
  3 demo docs see the tour on first dashboard load)
- Commit: `feat(onboarding): mount tour overlay on first dashboard visit`

## Tests required

- All deliverables must add tests as listed.
- `npm test` must pass (currently 249).
- New tests should add ~10–15 to total.

## Definition of done

- `npm test` ✅ all passing
- `npm run lint` ✅ clean
- `npx tsc --noEmit` ✅ clean
- `npx next build` ✅ clean
- Migration written but NOT applied (Augment applies via Supabase MCP after review)
- All 4 commits pushed to `track-mm-onboarding-tour`
- PR body includes the QA hook: sign in as fresh user → see tour → click through →
  refresh → tour does not reappear

## Tour content (use exactly these)

| Step | Target | Title | Body |
|---|---|---|---|
| 1 | `[data-tour="upload"]` | "Start with a contract" | "Drop a PDF you've signed. Leases, NDAs, employment offers — we read all of them." |
| 2 | `[data-tour="documents"]` | "Watch Clausly read" | "Analysis takes ~30s. We extract clauses, dates, and risk. Click any contract to open it." |
| 3 | `[data-tour="clauses"]` | "Skim the clauses" | "Plain-English summaries of the parts that matter. Click one to see the source." |
| 4 | `[data-tour="reminders"]` | "Approve a reminder" | "We suggest reminders for renewals and deadlines. Nothing fires without your nod." |
