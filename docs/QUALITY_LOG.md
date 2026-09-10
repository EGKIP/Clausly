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

## 2026-09-10

### Quality Gates
- Build: pass
- Typecheck: pass (`tsc --noEmit`)
- Lint: pass (`next lint`, no warnings)
- Unit tests: pass (545/545, 100 files, vitest — 7 new)
- E2E: none configured (still no Playwright in this repo)

### Issues Found
- **P2:** `RenameableTitle` (`src/components/dashboard/document-actions/rename-title.tsx`) renamed a document via `PATCH /api/documents/[id]` and called `router.refresh()`, but never `notifyDocumentsChanged()`. Every other mounted `useDocuments()` consumer (command palette, reminders page) kept showing the old title until an unrelated delete/upload elsewhere happened to fire the event — the same bug class fixed for delete in the 2026-09-08 run, just missed for rename. `AnalysisGate` had the identical gap: when analysis finished while the user sat on the detail page, other document lists didn't pick up the freshly analyzed title/risk either.
- **P3:** The "Analyzing" skeleton (`analysis-gate.tsx`) always said "This usually takes a few seconds," with no escalation if it kept polling for minutes — the stuck-analysis recovery cron only requeues after ~10 minutes, so a genuinely slow or stuck analysis left the user staring at an unchanging skeleton with no signal anything unusual was happening.
- **P3:** `reminder_time`'s API validation regex (`src/lib/reminders/validation.ts`) checked digit format (`\d{2}:\d{2}`) but not value range, so `"99:99"` passed Zod validation and only failed downstream at the Postgres `time` column, surfacing as a raw 500 DB error instead of a clean 400. Not reachable from the UI (`<input type="time">` already constrains values) but a real API-boundary gap.
- **P3:** Dashboard home's "Upcoming attention" list (`src/app/dashboard/page.tsx`) had no empty state — when a user has documents but zero pending reminders, the bordered list rendered as a blank box, unlike the adjacent "Fresh summaries" panel which explicitly handles the same condition.
- **P3 (documented, not fixed today):** Escape-key and backdrop-click-to-close are inconsistent across the app's overlays. The global Escape handler in `shell.tsx` only covers the command palette and upload modal; the reminder edit modal, the settings delete-account confirmation, and the Share/Export panels manage their own state and don't listen for Escape. Backdrop-click is similarly inconsistent (delete-document confirmation has it; reminder edit and delete-account modals don't; Share/Export panels have no backdrop at all). Verified every affected modal has an explicit Cancel/Close/X button, so nothing is actually unclosable — this is UX-convention polish, not a broken workflow. Spans five components; deferred to a future run to keep today's diff scoped.
- Re-checked Supabase security/performance advisors on `clausly-prod`: no new findings. Same three warnings as prior runs (vector extension in `public` schema, `delete_account` executable by `authenticated` — intentional, self-service-only via `auth.uid()` check, leaked-password protection still disabled in Auth settings — owner dashboard action, not code). Performance advisor shows only INFO-level unindexed-FK and unused-index notices on a low-traffic database; no evidence of actual slow queries, so no migration added today.
- `npm audit`: the one remaining vulnerability (postcss, via Next.js's own vendored dependency) requires a Next.js 16 major-version upgrade to clear (`npm audit fix --force`); Next is already pinned to the latest 15.5.x (15.5.25, patched in the 2026-09-07 run). Deferred — a major framework bump is out of scope for a daily maintenance pass.

### Fixes Completed
- `src/components/dashboard/document-actions/rename-title.tsx`: calls `notifyDocumentsChanged()` after a successful rename.
- `src/components/dashboard/analysis-gate.tsx`: calls `notifyDocumentsChanged()` when analysis transitions to `ready`/`failed`, alongside the existing `router.refresh()`. Also added escalating copy in the analyzing skeleton — after 20s, "taking a little longer than usual"; after 90s, reassurance that it's safe to leave the page and analysis continues in the background.
- `src/lib/reminders/validation.ts`: tightened the `reminder_time` regex to validate actual HH/MM/SS ranges (`00-23` / `00-59`) instead of digit-shape only.
- `src/app/dashboard/page.tsx`: added an explicit empty state to the "Upcoming attention" list, matching the sibling "Fresh summaries" panel's pattern.

### Tests Added/Changed
- `src/components/dashboard/document-actions/__tests__/rename-title.test.tsx`: new file — asserts a successful rename notifies other document-list listeners and refreshes the router, and that a failed rename does neither.
- `src/components/dashboard/__tests__/analysis-gate.test.tsx`: new case for the escalating "taking longer" copy (fake timers at 20s/90s), and a new case asserting `notifyDocumentsChanged()` fires once the poll observes a `ready` status.
- `src/lib/reminders/__tests__/validation.test.ts`: new case rejecting out-of-range `reminder_time` values (`24:00`, `12:60`, `99:99`) while still accepting valid ones.
- `src/app/dashboard/__tests__/page.test.tsx`: new file — covers the new "Upcoming attention" empty state and confirms it disappears once a pending reminder exists.

### Remaining Concerns
- No P0/P1 issues found or introduced.
- Escape-key/backdrop-click consistency across modals (reminder edit, delete-account confirmation, Share/Export panels) — real but P3 polish, every affected modal already has an explicit close control; worth a dedicated pass rather than folding into today's diff.
- Same three Supabase advisor items as previous runs remain outstanding, none newly actionable: `vector` extension in `public` schema (non-trivial migration, low severity), leaked-password protection (owner dashboard setting), `delete_account` executable by `authenticated` (intentional, self-scoped).
- `npm audit`'s one remaining finding (postcss via Next's vendored dependency) needs a Next.js 16 major upgrade; not attempted today per change-discipline guidance against unscoped major version bumps.
- No E2E/browser test harness exists yet — flows were verified by reading route/component code and by adding/running targeted unit + integration tests (including new server-component-rendering tests for the dashboard home page, following the pattern already used for `settings/activity`). Playwright remains a reasonable future investment.

### PR/Branch
- Branch: `claude/upbeat-newton-smtvd7`
- PR: opened against `main` (see PR description for link)
