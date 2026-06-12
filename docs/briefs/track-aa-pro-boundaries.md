# Track AA — Pro tier boundaries + gating (no Stripe)

**Owner:** Codex
**Branch:** `track-aa-pro-boundaries`
**Base:** `main` at `f5f96e8`
**Estimated effort:** ~half day to full day

## Goal

Make `subscription_tier` ('free' | 'pro') actually mean something. Build a single
plan-resolution layer, enforce limits in the routes that need it, and surface
plan state + upgrade CTAs in the UI. Stripe + checkout are deferred to Track BB.

## Non-goals (do NOT touch)
- No Stripe code, no `subscriptions` table, no `/api/checkout`.
- No real upgrade flow — only a placeholder `/upgrade` page.
- No Document Q&A endpoint or Ask-Clausly gating (Q&A endpoint doesn't exist yet).

## Architecture

Create one source-of-truth module: `src/lib/billing/plan.ts`.
Everything else imports from here. No tier strings sprinkled in routes.

## Scope — 8 deliverables

### 1. `src/lib/billing/limits.ts`
Pure constants. PRD §9 anchored.
```ts
export const PLAN_LIMITS = {
  free: { maxDocuments: 5, hasInsights: false, hasPriorityProcessing: false },
  pro:  { maxDocuments: Infinity, hasInsights: true, hasPriorityProcessing: true },
} as const;
export type PlanName = keyof typeof PLAN_LIMITS;
```

### 2. `src/lib/billing/plan.ts`
- `getUserPlan(supabase, userId): Promise<PlanName>` — reads `users.subscription_tier`, defaults to `'free'` on error/missing.
- `canUploadDocument(supabase, userId): Promise<{ allowed: boolean; current: number; limit: number; plan: PlanName }>` — counts user's documents (any status), compares to plan limit.
- `canAccessInsights(supabase, userId): Promise<{ allowed: boolean; plan: PlanName }>`.
- Pure server-side; no client imports.

### 3. Enforce in `/api/upload`
- Before storage write, call `canUploadDocument`.
- If `!allowed`: return `402 Payment Required` with body `{ error: "Free plan is limited to 5 documents.", code: "PLAN_LIMIT_DOCUMENTS", current, limit, plan }`.
- Keep `hasSupabaseEnv()` mock-mode behavior intact (skip check when not configured).

### 4. Enforce in `/dashboard/insights/page.tsx`
- Server component: resolve plan; if `!canAccessInsights.allowed`, render new `<InsightsUpgradeCard />` instead of the insights body.
- Component lives at `src/components/dashboard/insights-upgrade-card.tsx` — editorial card with "Pro · Insights" eyebrow, value-prop bullets pulled from PRD §9.3, "Upgrade to Pro" CTA linking to `/upgrade`.

### 5. Expose plan in `/api/profile` GET
- Add `plan`, `usage: { documents: { current, limit } }` to the response.
- Update `Profile` type in `src/app/dashboard/settings/page.tsx` to consume it.

### 6. Settings page — Plan section
- New section above Notifications, below profile basics.
- Show current plan as a `<Badge>` (Free / Pro with sparkle icon for Pro).
- Show usage row: "Documents: 3 / 5" (or "Documents: 12 / Unlimited" for Pro).
- "Upgrade to Pro" button (`href="/upgrade"`) when plan is free. Hide when pro.
- Match existing settings page editorial style.

### 7. Upload modal — usage badge + limit handling
- In `src/components/dashboard/upload-modal.tsx` (or wherever upload happens):
  - Fetch usage on mount from `/api/profile`.
  - Show subtle "3 / 5 documents used" line above the dropzone for Free users.
  - Disable submit button when at limit; show inline "Upgrade to Pro for unlimited uploads" with link to `/upgrade`.
- Handle 402 response from `/api/upload`: surface the message + upgrade link in the modal's error area (don't crash).

### 8. `/upgrade` page placeholder
- New route `src/app/upgrade/page.tsx`.
- Editorial page reusing marketing primitives. Headline "Upgrade to Pro", value-prop list, single CTA "Coming soon — Stripe checkout opens in Track BB".
- No real form. This is so all the "Upgrade to Pro" buttons go somewhere instead of 404.

## Tests required

- `src/lib/billing/__tests__/plan.test.ts` — getUserPlan defaults to free on missing row; canUploadDocument respects free limit (5) and pro Infinity; canAccessInsights gates correctly.
- Extend upload route tests with: at-limit returns 402, under-limit succeeds, pro user with 100 docs still succeeds.
- New profile route test: response shape includes `plan` + `usage`.
- All existing 156 tests must still pass.

## QA hook (no admin UI needed)

Document in the PR description: to test Pro paths manually, run this against `clausly-prod`:
```sql
UPDATE public.users SET subscription_tier = 'pro' WHERE id = '<user_id>';
```
And to revert:
```sql
UPDATE public.users SET subscription_tier = 'free' WHERE id = '<user_id>';
```

## Commit cadence — commit + push after EACH phase

1. `feat(billing): add plan resolution + limit constants` (deliverables 1, 2 + plan.test.ts)
2. `feat(billing): gate upload route at free plan document limit` (deliverable 3 + upload tests)
3. `feat(billing): gate insights page behind pro` (deliverable 4)
4. `feat(billing): expose plan + usage from /api/profile` (deliverable 5)
5. `feat(settings): plan section with usage + upgrade CTA` (deliverable 6)
6. `feat(upload): show usage + handle 402 in upload modal` (deliverable 7)
7. `feat(upgrade): placeholder /upgrade page` (deliverable 8)

Push branch after each commit. Open the PR after commit 7 with a checklist of all 8 deliverables.

## Done criteria
- 7 commits on `track-aa-pro-boundaries` pushed
- `npm test` 156 + new tests passing
- `npm run lint`, `npx tsc --noEmit`, `npx next build` all clean
- Manual SQL flip toggles Pro paths correctly
- PR description includes the QA SQL hook
