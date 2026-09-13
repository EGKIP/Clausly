# Quality Log

Daily autonomous quality/maintenance runs for Clausly. Newest entries at the bottom. Entries are not rewritten after the fact.

## 2026-09-03

### Quality Gates
- Build: pass
- Typecheck: pass (`tsc --noEmit`)
- Lint: pass (`next lint`, no warnings)
- Unit tests: pass (524/524, 97 files, vitest)
- E2E: none configured (no Playwright in this repo yet)

### Issues Found
- **P3 (hardening):** Supabase security advisor flagged mutable `search_path` on `public.set_updated_at`, `public.match_document_chunks`, `public.match_portfolio_chunks`. Not exploitable today (no unqualified/shadowable references in their bodies), but pinning `search_path` is standard defense-in-depth.
- **P3 (hardening):** `public.handle_new_user()` (the `on_auth_user_created` trigger function) was directly executable via PostgREST RPC by `anon`/`authenticated`. Calling it outside trigger context errors out (`NEW` is unset), so not exploitable, but the grant was unnecessary surface.
- **P4 (info, no code fix):** `auth_leaked_password_protection` is disabled in Supabase Auth settings. This is a dashboard/account setting, not a migration — recommend the owner enable it in Supabase Auth → Policies.
- **P4 (info, no code fix):** `vector` extension is installed in the `public` schema rather than a dedicated schema. Low risk; moving it is a nontrivial migration (every `vector` column/type reference would need re-qualifying) and not worth the churn right now.
- Reviewed `sendWelcomeEmailOnceForUser` (`src/lib/notifications/welcome.ts`): read-then-write idempotency check has a narrow race if the auth callback fires twice concurrently (e.g. duplicate navigation to `/auth/callback`), which could send two welcome emails. Sequential idempotency is tested; concurrent idempotency is not. Judged P4/cosmetic (duplicate transactional email, no data or security impact) — not fixed today to avoid changing failure-handling semantics without a stronger justification. Documented for a future pass if it recurs in practice.

### Fixes Completed
- Added `supabase/migrations/20260903000100_harden_function_search_path.sql`: pins `search_path = public` on `set_updated_at`, `match_document_chunks`, `match_portfolio_chunks`, and revokes the unused public/anon/authenticated execute grants on `handle_new_user`. Pure `ALTER FUNCTION`/`REVOKE` statements — no behavior change, not yet applied to the live database (ships through the normal migration/deploy path).

### Tests Added/Changed
- None. The migration has no application-code surface to unit test; correctness was verified by re-reading the live function bodies via Supabase's read-only advisor/schema tools against `clausly-prod` (no writes made to the database in this session).

### Remaining Concerns
- No P0/P1 issues found. Auth, document upload/analysis, reminders, and tenant-isolation flows all have passing regression coverage (see `tests/integration/rls-isolation.test.ts` for cross-user isolation).
- No E2E/browser test harness exists yet (no Playwright config, no live Supabase credentials in this environment) — UI flows were verified by reading route/component code and existing component tests, not by driving a live browser. Adding Playwright is a reasonable future investment given the app is otherwise stable.
- Owner action recommended (not code): enable leaked-password protection in Supabase Auth settings for `clausly-prod`.

### PR/Branch
- Branch: `claude/upbeat-newton-5i3moz`
- PR: opened against `main` (see PR description for link)

## 2026-09-08

### Quality Gates
- Build: pass
- Typecheck: pass (`tsc --noEmit`)
- Lint: pass (`next lint`, no warnings)
- Unit tests: pass (538/538, 98 files, vitest — 7 new)
- E2E: none configured (still no Playwright in this repo)

### Issues Found
- **P1:** Approving a reminder already blocks a past `fire_on` date (`/api/reminders/[id]/approve`), but editing an *already-approved* reminder via `PATCH /api/reminders/[id]` had no equivalent guard — a user could silently drag an approved reminder's date into the past and it would sit there forever with no email ever firing and no error shown. Compounding it, the "date has already passed" warning in `DocumentRemindersSection` only rendered on rows with an `onApprove` handler, which approved rows never have, so there was no visual signal either.
- **P2:** `DeleteDocumentButton` never called `notifyDocumentsChanged()` after a successful delete (unlike the upload flow, which does). Any other mounted consumer of `useDocuments()` — the command palette, the reminders page — kept showing the deleted document until it happened to remount, so a user could delete a doc, open ⌘K, click the still-listed result, and land on a 404.
- **P2:** `DELETE /api/documents/[id]` removed the Storage object before deleting the DB row. If the DB delete then failed, the file was already gone but the document row (and its UI entry) remained, with no way to preview/reopen it and no cleanup path.
- **P3 (deploy hygiene, not app code):** Confirmed via Supabase advisors that the security-hardening migrations written in the two most recent daily runs (search_path pin, `handle_new_user`/`delete_account` grant tightening) were still flagged as unresolved in production — `list_migrations` on `clausly-prod` showed only one migration (`document_analysis_recovery`) ever actually applied. The repo also had two migration files sharing the identical version prefix `20260903000100`, which would collide in Supabase's migration-history table on a real `supabase db push`.
- **P4:** `DELETE /api/reminders/[id]` (dismiss) had no guard against dismissing an already-`sent` reminder, unlike `PATCH` and `approve`, which both reject it with 409. Not reachable from the current UI, but an API-level inconsistency.
- Reviewed the stuck-analysis polling path (`use-document.ts` + `analysis-gate.tsx`): recovery is handled by the `/api/admin/recover-stuck-analyses` cron (every 10 min, 10-min stuck threshold), so a genuinely stuck job can leave a user watching a plain "Reading your contract…" skeleton for up to ~30 minutes with no in-UI "this is taking a while" messaging. Judged P3 and not fixed today — the existing cron already bounds the damage, and a client-side timeout banner is a reasonable future improvement without urgency.

### Fixes Completed
- `src/app/api/reminders/[id]/route.ts`: PATCH now rejects updates to an approved reminder whose effective `fire_on` (after any date override in the same request) is in the past, mirroring the approve endpoint. DELETE now rejects dismissing a `sent` reminder (409), matching PATCH/approve.
- `src/components/dashboard/reminders/reminder-edit-modal.tsx`: client-side check blocks saving an approved reminder into a past date before the request is even sent.
- `src/components/dashboard/reminders/document-reminders-section.tsx`: the "date has already passed" warning now renders for approved rows too, not just suggested ones awaiting approval.
- `src/components/dashboard/document-actions/delete-document-button.tsx`: calls `notifyDocumentsChanged()` after a successful delete so every mounted document list (command palette, reminders page, etc.) drops the deleted document immediately.
- `src/app/api/documents/[id]/route.ts`: delete order swapped so the DB row is removed first (the durable, user-visible step) and Storage cleanup happens after, best-effort — a storage-removal failure no longer leaves an orphaned, broken document visible in the UI.
- Applied the previously-unshipped `harden_function_grants` migration directly to `clausly-prod` via Supabase MCP (pure `GRANT`/`REVOKE`/`ALTER FUNCTION … SET search_path`, no data touched): `anon` can no longer call `delete_account`/`handle_new_user` via RPC, and `search_path` is pinned on `set_updated_at`/`match_document_chunks`/`match_portfolio_chunks`. Verified via Supabase security advisors and a direct `has_function_privilege` query before/after. Removed the redundant, duplicate-timestamped `20260903000100_harden_function_search_path.sql` migration file from the repo (fully superseded by `20260903000100_harden_function_grants.sql`, which was already checked in).

### Tests Added/Changed
- `src/app/api/reminders/[id]/__tests__/route.test.ts`: past-date rejection on PATCH for approved reminders (including "any edit blocked until the date itself moves forward" parity with approve), confirms suggested reminders can still be freely edited to any date, and a new case for DELETE rejecting a `sent` reminder.
- `src/components/dashboard/reminders/reminder-edit-modal.test.tsx`: new case asserting the modal blocks save and shows an error when moving an approved reminder's date into the past; fixed a stale hardcoded `fireOn: "2026-07-01"` fixture (now in the past relative to real time) to a relative future date so it stops rotting.
- `src/components/dashboard/document-actions/__tests__/delete-document-button.test.tsx`: asserts `DOCUMENTS_CHANGED_EVENT` fires after a successful delete.
- `src/app/api/documents/[id]/__tests__/route.test.ts`: new case confirming the document row is still deleted (200) even when Storage cleanup fails.
- `tests/helpers/supabase.ts`: added `failNextStorageRemove()` helper (mirrors the existing `failNext()` for table ops) to simulate a Storage `remove()` failure in tests.

### Remaining Concerns
- No P0 issues found. No new P1s beyond the one fixed above.
- Supabase advisor still flags `delete_account` as callable by `authenticated` — this is intentional (any signed-in user must be able to delete their *own* account) and the function already enforces `auth.uid() = target_user_id` internally; not further reducible without breaking the feature.
- Owner action still recommended (dashboard setting, not code): enable leaked-password protection in Supabase Auth → Policies for `clausly-prod`.
- `vector` extension still installed in the `public` schema (Supabase advisor, low severity) — moving it is a non-trivial migration touching every `vector` column/type reference; still not worth the churn today.
- Stuck-analysis polling has no in-UI "taking longer than usual" messaging (see Issues Found) — worth picking up in a future run.
- No E2E/browser test harness exists yet — flows were verified by reading route/component code, adding/running targeted unit + integration tests, and (for the DB/RLS layer) live read-only queries against `clausly-prod` via Supabase MCP. Playwright remains a reasonable future investment.

### PR/Branch
- Branch: `claude/upbeat-newton-0ayodt`
- PR: opened against `main` (see PR description for link)

## 2026-09-13

### Quality Gates
- Build: pass
- Typecheck: pass (`tsc --noEmit`)
- Lint: pass (`next lint`, no warnings)
- Unit tests: pass (546/546, 100 files, vitest — 8 new)
- E2E: none configured (no Playwright test suite in the repo yet; used a one-off Playwright session against `next dev` in mock mode to visually verify the mobile share-dialog fix, see below)

### Issues Found
- **P1:** `PATCH /api/profile` (`mergeNotificationPreferences`) legitimately writes `version`/`defaults` keys into the shared `users.notification_preferences` JSON column (used for unsubscribe-token versioning), but `updatePreferences()` in `src/lib/db/notification-preferences.ts` asserted an allow-list of `{email, reminders, weekly_digest, welcome_email_sent_at}` and threw `Unsupported notification preference key: version` on anything else. Once any code path wrote a `version` key onto a user's row, every subsequent `PATCH /api/settings/notifications` (the live Settings → Email notifications toggles) would 500 permanently for that user. The live UI doesn't currently exercise the `/api/profile` notification-preferences path (its only component, `NotificationPreferencesCard`, is built and tested but not rendered anywhere), so this wasn't yet reachable by real users through the shipped UI — but the API route itself is live, documented, and reachable directly, and would immediately break Settings the moment that card (or any other client) is wired up or called directly.
- **P2:** The public share digest (`getPublicShareDigest` in `src/lib/db/share-digest.ts`, rendered at `/share/[token]`) listed *every* reminder for a shared document as a "Recommended action," including reminders still in `status: 'suggested'` (raw AI output the document owner never reviewed) and `status: 'ignored'` (reminders the owner explicitly dismissed as irrelevant). Anyone holding a share link would see unvetted or explicitly-rejected suggestions presented as the owner's recommended actions — an output-integrity problem for a share feature whose whole premise is a curated, owner-approved digest. No test file existed for `share-digest.ts` at all.
- **P2:** `/dashboard/insights` (the Pro "contract health" page) hard-coded `const monthlySpend = 2054` for the hero headline and "Monthly spend" stat tile, shown to every Pro user regardless of their actual portfolio — while the "Where your money is going" breakdown immediately below it on the same page correctly summed each document's real `monthly_value`. The two numbers on the same page could visibly disagree, and the headline was fake data dressed up as personalized insight. No test file existed for the insights page.
- **P2:** `useReminders()`'s `refetch()` (`src/lib/hooks/use-reminders.ts`) had no try/catch around its `fetch()` call, unlike the otherwise-identical `useDocuments()` hook. Any network failure (offline, DNS hiccup, backend blip) left `isLoading` stuck `true` forever — the reminders section spins indefinitely with no error shown — and produced an unhandled promise rejection (confirmed via a new test; it also surfaced as real console noise while testing the insights-page fix above, since `PastRemindersArchiveCard` uses this hook).
- **P2 (mobile UX, confirmed live in a browser):** The `ShareDialog` flyout (`src/components/dashboard/share/share-dialog.tsx`) was `position: absolute; right: 0` relative to its own trigger button, which sits as the 2nd of 4 action buttons in a wrapping row on the document detail page — not pinned to the screen edge like the topbar's user menu (which this pattern was presumably copied from). At a 375px viewport this rendered the panel roughly 150px off the left edge of the screen, clipping the title and most of the content (screenshot taken via a one-off Playwright session against `next dev` in mock mode). The dialog also had no Escape-key handling, unlike the app's other modal (`CompareWithButton`, which at least closes on backdrop click).

### Fixes Completed
- `src/lib/db/notification-preferences.ts`: added `version` and `defaults` to `allowedStoredKeys` so a prior `/api/profile` write can never wedge future `/api/settings/notifications` updates.
- `src/lib/db/share-digest.ts`: reminders query now filters `.in("status", ["approved", "sent"])`, so a share link only ever surfaces action items the document owner actually approved (or that already fired), never unreviewed or dismissed ones.
- `src/app/dashboard/insights/page.tsx`: `monthlySpend` is now computed from the same real per-document `monthly` values the breakdown list below it already uses, instead of a hard-coded placeholder.
- `src/lib/hooks/use-reminders.ts`: wrapped `refetch()`'s fetch call in try/catch (mirroring `useDocuments()`), so a network failure now surfaces a real "Unable to load reminders." error and clears the loading state instead of spinning forever.
- `src/components/dashboard/share/share-dialog.tsx`: rewrote the flyout as a centered, backdrop-based modal (the same `fixed inset-0` + centered-panel pattern already used by `CompareWithButton`), capped at `max-w-[380px]` with `max-h-[85vh]` overflow, so it can never be clipped by the viewport regardless of where its trigger sits in the action row. Also added an Escape-key handler to close it. Verified visually at 375px and 1280px via a one-off Playwright session against `next dev` in mock mode (screenshots not committed; app has no checked-in Playwright suite).

### Tests Added/Changed
- `src/lib/db/__tests__/notification-preferences.test.ts`: new case reproducing the exact cross-endpoint scenario (a stored row already carrying `version`/`defaults`) and asserting `updatePreferences` now succeeds and preserves those keys.
- `src/lib/db/__tests__/share-digest.test.ts`: new file — covers the unknown-token case, a normal digest, and specifically asserts only `approved`/`sent` reminders appear in `recommendedActions` (never `suggested` or `ignored`).
- `src/app/dashboard/insights/__tests__/page.test.tsx`: new file — asserts the hero/stat-tile spend figure is the real sum of seeded documents' `monthly_value`, and that free-plan users see the upgrade teaser instead of any spend figure.
- `src/lib/hooks/__tests__/use-reminders.test.ts`: new case asserting a rejected fetch resolves to `isLoading: false` with a real error message instead of hanging.
- `src/components/dashboard/share/share-dialog.test.tsx`: new case asserting Escape closes the dialog.

### Remaining Concerns
- No P0 issues found. The one P1 found today is fixed; no other P1s are known.
- Two other modals (`CompareWithButton`, `reminder-edit-modal.tsx`) still lack an Escape-key handler (they do close on other affordances — backdrop click or a Cancel/X button) — same class of issue as the `ShareDialog` fix today, lower urgency since neither has a confirmed viewport-clipping bug. Worth a follow-up pass to add Escape handling consistently, ideally via one small shared hook instead of copy-pasting the listener a third time.
- A same-day review pass (2 parallel sub-agent reviews, not independently re-verified line-by-line the way the notification-preferences and insights findings above were) surfaced further candidates not fixed today: PDF export (`src/lib/exports/pdf.ts`) silently truncates to 10 clauses with no "N more" indicator while the CSV/zip export includes all of them; `getOrCreateStripeCustomer` has a check-then-insert race that could create an orphaned Stripe customer on a rapid double-submit; `/api/seed-demo`'s empty-portfolio check is similarly check-then-act and could double-seed an account from two concurrent requests; and the compare/export rate-limit gates use the same check-then-record pattern, allowing a possible one-request quota overrun under concurrent load. All are P2/P3, none confirmed to have caused a real incident; flagged here for a future run rather than fixed speculatively today.
- Supabase advisors (`clausly-prod`) are unchanged since the last run: `delete_account` remains callable by `authenticated` (intentional, enforces `auth.uid()` internally), `vector` extension still lives in `public` (low severity, non-trivial migration to move), and leaked-password protection is still disabled in Supabase Auth settings (dashboard setting, not code — owner action recommended). New this run: the performance advisor lists 9 unindexed foreign keys and 7 unused indexes across `clauses`, `dates`, `reminders`, `document_shares`, etc. — all INFO-level, no evidence of real query slowness yet at current data volumes; noted for a future pass rather than added speculatively today.
- Still no committed Playwright/E2E suite. Today's mobile-dialog fix was verified with a throwaway Playwright script run against `next dev` in mock mode (screenshots, not committed) rather than a regression test that runs in CI — a real Playwright suite (even just a handful of critical-path specs) remains the single highest-leverage testing investment left for this app, called out in every run so far.

### PR/Branch
- Branch: `claude/upbeat-newton-x6i7ts`
- PR: opened against `main` (see PR description for link)
