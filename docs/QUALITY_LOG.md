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

## 2026-09-11

### Quality Gates
- Build: pass
- Typecheck: pass (`tsc --noEmit`)
- Lint: pass (`next lint`, no warnings)
- Unit tests: pass (552/552, 100 files, vitest — 14 new)
- E2E: none configured (still no Playwright in this repo)

### Issues Found
- **P2 (recurring, documented but unfixed in the 2026-09-09 and 2026-09-10 runs — both still open as unmerged PRs #71/#72):** Several dialogs/dropdowns across the app couldn't be dismissed with Escape, and two had no click-outside-to-close either, inconsistent with the rest of the app (upload modal, command palette, mobile nav drawer all support Escape via `shell.tsx`). Specifically: `ReminderEditModal` (no Escape, no backdrop click), the settings "Delete account" confirmation (no Escape, no backdrop click — the backdrop `<div>` had no dismiss handler at all), `DeleteDocumentButton`'s confirmation (had backdrop click, no Escape), and the `ShareDialog`/`ExportButton` popovers (absolutely-positioned dropdowns with no backdrop and no outside-click handling of any kind — clicking anywhere else on the page left them open). Every affected dialog already had an explicit close control, so nothing was truly unclosable, but the inconsistency is real UX friction and a WAI-ARIA dialog-pattern gap.
- Verified `notification-preferences-card.tsx` (flagged as dead code in the 2026-09-09 run) was in fact unused except for one type-only import in `settings/page.tsx`; the component it was superseded by (`notification-preferences.tsx`) is the only one actually rendered.
- Re-checked Supabase security/performance advisors on `clausly-prod`: no new findings since the 2026-09-08 run (same three: `vector` extension in `public` schema, `delete_account` executable by `authenticated` — intentional, self-scoped via `auth.uid()` — and leaked-password protection disabled, an owner Auth-settings action, not code). Performance advisor shows only INFO-level unindexed-FK/unused-index notices on a low-traffic database.
- No new P0/P1s found. PRs #71 and #72 from the two prior runs remain open and unmerged (owner review pending); this run built on `main` independently rather than stacking on top of them, to avoid depending on unreviewed changes.

### Fixes Completed
- Added `src/lib/hooks/use-dismiss-on-escape.ts` and `src/lib/hooks/use-click-outside.ts` — small, single-purpose hooks (Escape-to-close, and click-outside-to-close for elements with no full-screen backdrop).
- Wired Escape + backdrop-click into `ReminderEditModal` and the settings "Delete account" modal (both previously had neither); added Escape to `DeleteDocumentButton`'s confirmation (already had backdrop click); added Escape + click-outside to the `ShareDialog` and `ExportButton` popovers. All respect in-flight saving/deleting state the same way the existing Cancel buttons already did (no dismiss mid-mutation).
- Deleted the dead `notification-preferences-card.tsx` component and its test; `settings/page.tsx` now derives its `NotificationPreferences` type directly from `notificationPreferencesSchema` in `@/lib/validation/schemas` instead of importing a type from the otherwise-unused file.

### Tests Added/Changed
- `src/lib/hooks/__tests__/use-dismiss-on-escape.test.ts`, `src/lib/hooks/__tests__/use-click-outside.test.tsx`: new, cover both hooks directly (active/inactive, Escape vs. other keys, inside vs. outside clicks).
- `reminder-edit-modal.test.tsx`, `delete-document-button.test.tsx`, `export-button.test.tsx`, `share-dialog.test.tsx`: new cases asserting Escape (and, where applicable, backdrop/outside click) closes each dialog, and that the reminder modal does not close on Escape while a save is in flight.
- `src/app/dashboard/settings/__tests__/page.test.tsx`: new file — first test coverage for this page, covering the delete-account confirmation's Escape and backdrop-click dismissal.

### Remaining Concerns
- No P0/P1 issues found or introduced.
- Same three Supabase advisor items as previous runs, none newly actionable (see Issues Found).
- `npm audit` still reports a moderate/high PostCSS advisory reachable only through Next.js's bundled dependency; the only fix path is a Next.js 16 major upgrade, out of scope for a targeted daily pass.
- PRs #71 and #72 (2026-09-09 and 2026-09-10 runs) remain open awaiting owner review; today's fixes are independent of both and shouldn't conflict, but all three will need to be merged in some order.
- No E2E/browser test harness exists yet, and this session had no live Supabase credentials configured (`.env.local` not present), so UI flows were verified by reading route/component code and by adding/running targeted unit + integration tests rather than driving a real browser. Playwright remains a reasonable future investment.

### PR/Branch
- Branch: `claude/upbeat-newton-wfnwuy`
- PR: opened against `main` (see PR description for link)
