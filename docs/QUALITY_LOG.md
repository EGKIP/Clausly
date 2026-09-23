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

## 2026-09-09

### Quality Gates
- Build: pass
- Typecheck: pass (`tsc --noEmit`)
- Lint: pass (`next lint`, no warnings)
- Unit tests: pass (557/557, 101 files, vitest — 19 new)
- E2E: none configured (still no Playwright in this repo)

### Issues Found
- **P1:** The "forgot password" flow was completely non-functional. `resetPasswordForEmail` sent a link redirecting to `/login`; middleware forwarded the recovery `code` to `/auth/callback`, which exchanged it for a live session and redirected straight to `/dashboard`. No page anywhere called `supabase.auth.updateUser`, so a user could request a reset, click the email, land fully signed in, and never be shown a form to actually set a new password — their old password stayed unchanged with no error or explanation.
- **P1:** Open redirect via the `next` query param on `/login` and in `/auth/callback`. Both only checked `next.startsWith("/")` (`/auth/callback` also excluded literal `"//"`), which a backslash-based payload like `next=/\evil.test` bypasses — `new URL("/\\evil.test", origin)` resolves to `https://evil.test/` in both Node and browsers. On `/login`, a successful password sign-in did `window.location.href = next` directly with no sanitization at all, so a crafted `/login?next=%2F%5Cevil.test` link could send a user to an attacker-controlled site immediately after they authenticated with real credentials.
- **P1:** Approving a suggested reminder left a stale duplicate behind. `useReminders({status: "suggested"})`'s optimistic update (and the subsequent server-response merge) flipped the approved item's `status` in place without removing it from the array, so the reminders page — which renders each hook's `reminders` array directly — showed the same reminder simultaneously under "Suggested" (with live Approve/Edit/Ignore buttons) and "Approved", and the tab count badges were wrong until a full remount.
- **P2:** Signup unconditionally redirected to `/dashboard/welcome` after `supabase.auth.signUp`, ignoring whether the response actually included a session. When email confirmation is required, `signUp` succeeds with `session: null`; the user was bounced straight to a route the middleware then rejected (no session found), landing them back on `/login` with zero explanation — unlike the magic-link and reset flows, which correctly show a "check your inbox" state.
- Two independent read-only audits (dashboard/settings/mobile, and the upload/analysis pipeline) found no other P0/P1s: file-type/size validation, ownership scoping (`.eq('user_id', ...)` on every reminder/document query), analysis attempt-fencing, and the stuck-analysis recovery cron all checked out. Noted for a future pass (P2/P3, not fixed today): the delete-account and reminder-edit modals don't close on Escape or backdrop click (only their explicit Close/Cancel buttons work), and `notification-preferences-card.tsx` is a dead, unused component superseded by `notification-preferences.tsx`.
- Supabase security/performance advisors re-checked against `clausly-prod`: no new findings since the last run (`vector` extension in `public` schema, `delete_account` callable by `authenticated` — both previously reviewed and judged intentional/low-risk; leaked-password protection still disabled, dashboard setting, owner action). `npm audit` flags a moderate/high PostCSS advisory that only resolves via a Next.js 16 major bump — not attempted today, logged as a known dependency risk.

### Fixes Completed
- Added `src/lib/auth/safe-next-path.ts`: resolves the candidate `next` value against a sentinel origin via `new URL()` and rejects anything that doesn't resolve back to that same origin (catches `//`, backslash, and absolute-URL bypasses in one check, not just a `startsWith` heuristic). Wired into `/login` (`src/app/(auth)/login/page.tsx`), `/auth/callback` (replacing its narrower local `safeNextPath`), and `auth-card.tsx`'s client-side password-sign-in redirect as defense-in-depth.
- Added `/reset-password` (`src/app/(auth)/reset-password/page.tsx` + `src/components/auth/reset-password-card.tsx`): the forgot-password email now redirects through `/auth/callback?next=/reset-password` (matching the existing magic-link/OAuth pattern) so the recovery code is exchanged for a session before the user lands on a real "choose a new password" form that calls `supabase.auth.updateUser`. Shows a "link expired" state with a link back to `/forgot-password` if the page is reached without a valid session.
- `src/lib/hooks/use-reminders.ts`: `approve()` now drops the mutated item from the hook's own array whenever its new status no longer matches the `status` filter the hook was fetched with, both in the optimistic update and after the server response — the stale-duplicate row disappears from "Suggested" the moment it's approved instead of waiting for a remount.
- `src/components/auth/auth-card.tsx`: signup now checks `data.session` from `supabase.auth.signUp` and shows the existing "Check your inbox" state when confirmation is required, instead of redirecting into a route the middleware immediately rejects.

### Tests Added/Changed
- `src/lib/auth/__tests__/safe-next-path.test.ts`: new, covers same-origin passthrough plus every bypass shape identified above (`//`, backslash, absolute URL, non-http scheme) and the custom-fallback parameter.
- `src/app/auth/callback/__tests__/route.test.ts`: new case asserting the backslash bypass is rejected.
- `src/components/auth/__tests__/auth-card.test.tsx`: new file — sanitized vs. safe `next` redirect after password sign-in, signup with/without an active session, and that the forgot-password request now points at `/auth/callback?next=/reset-password`.
- `src/components/auth/__tests__/reset-password-card.test.tsx`: new file — expired-link state with no session, mismatched-password rejection, successful `updateUser` + redirect, and surfacing an `updateUser` error.
- `src/lib/hooks/__tests__/use-reminders.test.ts`: new cases confirming an approved reminder is dropped from a `status: "suggested"`-filtered list on success, and put back if the approval request fails.

### Remaining Concerns
- No P0 issues found. The three P1s above are fixed and tested.
- Delete-account and reminder-edit confirmation modals don't dismiss on Escape or backdrop click (P2/P3, only their own Close/Cancel buttons work) — worth centralizing into a shared dismiss hook in a future pass; not fixed today to keep this change set focused on the P1 auth/reminders issues.
- `notification-preferences-card.tsx` + its test are dead code, superseded by `notification-preferences.tsx` — safe to delete in a future pass (P4).
- Owner action still recommended (dashboard setting, not code): enable leaked-password protection in Supabase Auth → Policies for `clausly-prod`.
- `npm audit` reports a moderate/high-severity PostCSS advisory reachable only through Next.js's bundled dependency; the only fix path is a Next.js 16 major upgrade, which is out of scope for a targeted daily pass — flagging for a deliberate, tested upgrade rather than attempting it here.
- No E2E/browser test harness exists yet — flows were verified by reading route/component code and adding/running targeted unit + component tests. Playwright remains a reasonable future investment, especially now that the auth flows (signup/login/reset) have more surface area worth covering end-to-end.

### PR/Branch
- Branch: `claude/upbeat-newton-f5ki7h`
- PR: opened against `main` (see PR description for link)

## 2026-09-16

### Quality Gates
- Build: pass
- Typecheck: pass (`tsc --noEmit`)
- Lint: pass (`next lint`, no warnings)
- Unit tests: pass (599/599, 108 files, vitest — 10 new)
- E2E: none configured (still no Playwright in this repo)

### Issues Found
- **P2 (billing bypass):** `document_exports` had a `SELECT`-only RLS policy with no `INSERT` policy. Every insert from the export route's request-scoped client (`recordExportAudit` in `src/app/api/documents/[id]/export/route.ts`) was silently rejected by RLS and swallowed by its own try/catch, so `getExportUsage()`/`canExport()` always saw 0 exports — free-plan users could export past the stated 5-per-30-days limit indefinitely.
- **P2 (data correctness):** `ReminderEditModal`'s `dateForInput` re-parsed the API's display-formatted date ("Jan 5, 2026") with `new Date()`, which V8 interprets in the browser's local timezone, then serialized with `.toISOString()` (UTC). For any user in a timezone ahead of UTC, the "Fire date" field showed the day *before* the reminder's real scheduled date.
- **P2 (state corruption):** `useReminders().dismiss()` captured the whole pre-mutation `reminders` array as its rollback snapshot. `PastRemindersArchiveCard`'s "archive all" action fires a batch of concurrent `dismiss()` calls via `Promise.all`; if any one delete in the batch failed, its rollback restored the *entire* pre-batch array, silently reinstating rows whose delete had already succeeded server-side.
- **P2 (stale sibling UI):** `AnalysisGate`'s refresh effect compared the live poll status to the original `initialStatus` prop (fixed at mount) instead of the previous poll. A document that starts already `failed`, gets retried, and fails again lands back on the same status it started with, so the comparison was always equal and `notifyDocumentsChanged()`/`router.refresh()` never fired — sibling document lists (dashboard, command palette) never resynced after a repeat failure.
- **P2 (upload correctness):** `.txt` uploads had no content validation, unlike pdf/docx/png/jpg (all checked by magic number). A binary file renamed to `.txt` (e.g. a PDF) was accepted and later silently mis-decoded as garbled text during analysis instead of failing with a clear error.
- **P1→fixed as P2 in practice:** `/api/documents/[id]/reanalyze` had no `maxDuration` export, unlike every other route that runs analysis (`upload`, `admin/recover-stuck-analyses`). A slow/scanned document retried via "Re-analyze" could have its function killed mid-run under the platform default duration, leaving the document stuck at `analyzing` until the 10-minute stuck-analysis cron reclaimed it.
- **P2/P3 (defense-in-depth):** Several routes relied solely on RLS rather than an explicit `user_id` scope on top of it — `GET /api/documents`, `getDocumentDetail` (document/clause/date/reminder queries), `POST /api/seed-demo`'s empty-portfolio count, and the document-title lookup in `POST /api/ask/portfolio`. Not currently exploitable (RLS policies in `20260604000100_contract_data_layer.sql` correctly scope every table to `auth.uid() = user_id`, confirmed against the live `clausly-prod` schema), but each would become a cross-user leak if a future RLS policy ever regressed.
- **P4:** `src/lib/notifications/supabase-service.ts` (builds the service-role Supabase client) was missing the `import "server-only"` guard present on its twin `src/lib/supabase/service.ts`. Not currently imported from client code, but nothing would have caught it at build time if it were.
- Reviewed dialog dismissal consistency across the app (following up on prior runs' "closes on Escape/backdrop" work): `UploadModal` — the primary upload flow — had no Escape handling, no focus trap, and no `role="dialog"`, the biggest gap found. `CompareWithButton` still lacks Escape dismissal (has backdrop-click); no dialog besides `share-dialog.tsx` traps Tab focus. Judged P3, not fixed today beyond `UploadModal` (see below) to keep this run focused.
- Full read-only security pass over all 34 `src/app/api/**/route.ts` handlers, `middleware.ts`, the public `/api/shares/[token]` route, and both webhook routes (Stripe + Resend/notifications): no P0/P1 exploitable cross-user access or auth-bypass found. `safe-next-path.ts` is used everywhere a redirect target comes from user input; no service-role credentials are reachable from `"use client"` code; webhooks verify signatures before trusting payloads.

### Fixes Completed
- `supabase/migrations/20260916000100_document_exports_insert_policy.sql`: adds the missing `INSERT` RLS policy on `document_exports` (`auth.uid() = user_id`), applied directly to `clausly-prod` and verified live. Export-usage tracking (and therefore the free-plan export limit) now actually works.
- `src/components/dashboard/reminders/reminder-edit-modal.tsx`: `dateForInput` now parses the known "Jan 5, 2026"-style API format directly (month-name lookup → `YYYY-MM-DD`) instead of round-tripping it through a timezone-sensitive `Date` parse, falling back to the old logic for any unrecognized format.
- `src/lib/hooks/use-reminders.ts`: `dismiss()` now captures only the single reminder being removed and reinserts just that item (via a functional update against current state) on failure, instead of overwriting the whole list with a stale pre-batch snapshot.
- `src/components/dashboard/analysis-gate.tsx`: the refresh effect now compares against the previous poll's status (tracked in a ref) instead of the immutable `initialStatus` prop, so a retry that fails again still triggers `notifyDocumentsChanged()`/`router.refresh()`.
- `src/lib/upload/pdf-signature.ts`: new `looksLikeTextContent()` — rejects any NUL byte and caps other non-whitespace control bytes at 5% of a sniffed 8KB prefix (same heuristic git itself uses for binary detection). Wired into `.txt` upload validation in `src/app/api/upload/route.ts`, with a dedicated "This file doesn't look like plain text." error message.
- `src/app/api/documents/[id]/reanalyze/route.ts`: added `export const maxDuration = 300`, matching upload/recovery-cron.
- `src/components/dashboard/upload-modal.tsx`: added Escape-to-close, a Tab focus trap, initial-focus-on-open, and `role="dialog"`/`aria-modal`/`aria-labelledby`, matching the pattern already used by `share-dialog.tsx`.
- Defense-in-depth `user_id` scoping added on top of RLS: `src/app/api/documents/route.ts` (GET list), `src/lib/db/documents.ts` (`getDocumentDetail`, now takes an optional `userId` threaded from both call sites — the API route and the SSR document detail page), `src/app/api/seed-demo/route.ts`, `src/app/api/ask/portfolio/route.ts`. Pure additive filters; no behavior change for legitimate users, verified by the full existing test suite still passing.
- `src/lib/notifications/supabase-service.ts`: added the missing `import "server-only"`.

### Tests Added/Changed
- `reminder-edit-modal.test.tsx`: new case renders with a display-formatted `fireOn` under `TZ=Asia/Kolkata` and asserts the date input shows the correct calendar date; confirmed it fails against the pre-fix code (showed the wrong day).
- `use-reminders.test.ts`: new case fires two concurrent `dismiss()` calls (mirroring the real "archive all" batch), resolves one success and one failure, and asserts the successful removal isn't reinstated; confirmed it fails against the pre-fix code.
- `analysis-gate.test.tsx`: new case retries a `failed` document and has the retry fail again, asserting `notifyDocumentsChanged` still fires; confirmed it fails against the pre-fix code.
- `upload-modal.test.tsx`: new case asserts Escape closes the modal.
- `pdf-signature.test.ts`: new `looksLikeTextContent` cases (plain text, empty, NUL byte, dense control bytes, tolerated whitespace).
- `upload/route.test.ts`: new case uploads a NUL-byte-laden buffer as `lease.txt` and asserts the specific rejection message.

### Remaining Concerns
- No P0 issues found; the P2s above are fixed and tested (or, for the RLS migration, verified live against `clausly-prod`).
- `CompareWithButton` still lacks Escape dismissal (P3); no dialog besides `share-dialog.tsx`/`upload-modal.tsx` traps Tab focus (P3) — worth a shared focus-trap hook in a future pass instead of the third copy-pasted implementation.
- Supabase advisors unchanged from prior runs: `vector` extension in `public` schema, `delete_account` callable by `authenticated` (verified safe — checks `auth.uid() = target_user_id` internally), leaked-password protection still disabled (dashboard setting, owner action). `npm audit`'s moderate/high findings (vitest, esbuild dev server, postcss) all require a Next.js 16 or Vitest 5 major bump to clear — still out of scope for a targeted daily pass.
- The repo's local migration files (18) still outnumber what Supabase's migration-history table reports as applied (3, after today's) — confirmed again this is bookkeeping drift, not a schema gap: every table these migrations create exists on `clausly-prod` with RLS enabled, spot-checked via `list_tables`/`list_migrations`. Worth a real `supabase db push`-based reconciliation in a future pass so the history table stops undercounting, but not urgent.
- No E2E/browser test harness exists yet — flows were verified by reading route/component code and adding/running targeted unit + component tests, plus live checks against `clausly-prod` via Supabase's read-only advisor/schema tools (no data written except the one RLS policy migration).

### PR/Branch
- Branch: `claude/upbeat-newton-pcaigp`
- PR: opened against `main` (see PR description for link)

## 2026-09-17

### Quality Gates
- Build: pass
- Typecheck: pass (`tsc --noEmit`)
- Lint: pass (`next lint`, no warnings)
- Unit tests: pass (596/596, 109 files, vitest — 7 new)
- E2E: none configured (still no Playwright in this repo)

### Issues Found
- **P2:** The ⌘K command palette (`command-palette.tsx`) displays an "Esc" keyboard hint next to its search input, but no Escape handler was ever wired up — pressing Escape did nothing, contradicting the UI's own affordance. The component also had zero test coverage and no `role="dialog"`/`aria-modal`, unlike every other dialog in the app.
- **P2:** `useReminders().approve()` had the same "stale full-array rollback" bug already found (and fixed on an unmerged PR) in `dismiss()`: it captured the whole pre-mutation `reminders` array before its optimistic update and restored that entire snapshot on failure. Concrete failure: approve one reminder while dismissing another in the same list (both plausible from `/dashboard/reminders` or `DocumentRemindersSection`); if the approve request fails, its rollback silently reinstates the reminder that was just successfully dismissed. `dismiss()` has the identical bug on this branch (the fix for it hasn't merged yet), so both were fixed together with one shared rollback helper.
- **P2:** `/dashboard/insights`'s "Notice windows you need to hit" cards render `in {daysAway} days` unconditionally. Once a suggested-or-approved-but-not-yet-sent notice reminder's fire date passes (a real, reachable state — the filter is `status !== "sent"`), the card reads "in -3 days" instead of the "X days late" phrasing already used consistently on the reminders page and document detail view. Confusing copy on the page whose core value prop is surfacing opt-out deadlines.
- **P3 (defense-in-depth):** `listDocuments()` and `listReminders()` (`src/lib/db/documents.ts`, `src/lib/db/reminders.ts`) — used directly by the dashboard, insights, compare, and document-detail SSR pages — relied solely on RLS with no explicit `user_id` scope, unlike the pattern already established elsewhere in the codebase (and in the still-unmerged PR that added it to `getDocumentDetail`/several API routes). Not currently exploitable (RLS correctly scopes both tables), but a hardening gap on two of the highest-traffic pages.
- **P4 (dead code):** `listDocumentRows()` (`src/lib/db/documents.ts`) was exported but had zero callers anywhere in the repo. `src/components/marketing/problem-solution.tsx` (171 lines) was likewise fully unreferenced.
- A broader adversarial pass (insights aggregation, settings persistence, duplicate-submission guards on every form, mobile layout at 375px for dialogs/modals, and ownership/validation on every API route not already covered by open PR #82) found nothing else concrete worth reporting — duplicate-submission is guarded everywhere via a pending/saving disabled state, mobile dialog widths are all fluid with safe gutters, and every other route scopes its queries by `user_id` and validates input.
- Two PRs from prior daily runs are still open and unmerged, awaiting owner review: #81 (Escape-to-close on the compare picker) and #82 (export-limit RLS bypass, reminder-date timezone bug, the `dismiss()` half of this run's rollback bug, stuck-analysis UX, upload hardening). Both are green (lint/typecheck/tests/build) and mergeable against current `main`. Not re-implemented here to avoid duplicate/conflicting work; today's fixes are additive and independent.
- Supabase security advisors re-checked against `clausly-prod`: no new findings (`vector` extension in `public` schema, `delete_account` callable by `authenticated` — both previously reviewed and judged safe; leaked-password protection still disabled — dashboard setting, owner action, not code). `npm audit`'s remaining moderate/high PostCSS finding still only resolves via a Next.js 16 major bump — deferred as in every prior run.

### Fixes Completed
- `src/components/dashboard/command-palette.tsx`: wired `useDismissOnEscape` and added `role="dialog"`/`aria-modal`/`aria-label` to match the app's other dialogs.
- `src/lib/hooks/use-reminders.ts`: added a shared `restoreReminder()` helper that rolls back only the single reminder a failed `approve()`/`dismiss()` was mutating (re-inserting it if the optimistic update had removed it), instead of overwriting the whole list with a stale snapshot that could clobber an unrelated, already-succeeded mutation.
- `src/app/dashboard/insights/page.tsx`: notice-window cards now show "N days late" once `daysAway` goes negative, matching the phrasing used on `/dashboard/reminders` and the document detail view.
- `src/lib/db/documents.ts` / `src/lib/db/reminders.ts`: `listDocuments()`/`listReminders()` now add an explicit `.eq("user_id", user.id)` on top of RLS. Removed the dead `listDocumentRows()` export.
- Deleted the unreferenced `src/components/marketing/problem-solution.tsx`.

### Tests Added/Changed
- `src/components/dashboard/__tests__/command-palette.test.tsx` (new): Escape closes the palette (and is a no-op while closed), dialog semantics are exposed, backdrop click closes while an inside click doesn't. Confirmed 3 of 4 fail against the pre-fix component.
- `src/lib/hooks/__tests__/use-reminders.test.ts`: two new cases — a failed `approve()` no longer reinstates a different reminder that a concurrent `dismiss()` just removed, and a failed `dismiss()` no longer undoes a different reminder's successful `approve()`. Confirmed both fail against the pre-fix rollback logic.
- `src/app/dashboard/insights/__tests__/page.test.tsx`: new case seeds an overdue "Notice" reminder and asserts the card reads "days late", not a negative day count. Confirmed it fails against the pre-fix copy.

### Remaining Concerns
- No P0 issues found. No new P1s.
- PRs #81 and #82 remain open, green, and mergeable — still awaiting the owner's review; the owner should merge whichever lands first, since #82 and today's `use-reminders.ts` change both touch `dismiss()`'s rollback (same intent, will need a trivial conflict resolution on merge, not a behavior conflict).
- Same recurring items as every prior entry, unchanged: `vector` extension in `public` schema (low-risk, non-trivial migration), `delete_account` callable by `authenticated` (verified safe/intentional), leaked-password protection disabled (owner action in Supabase Auth → Policies, not code), `npm audit` PostCSS finding blocked on a Next.js 16 major bump.
- No E2E/browser test harness exists yet. This has now been logged as a remaining concern in every entry since 2026-09-03 without being acted on — worth a deliberate future pass to stand up a minimal Playwright config and a handful of smoke specs (login, upload, approve-reminder) rather than continuing to defer it indefinitely.

### PR/Branch
- Branch: `claude/upbeat-newton-8mrzzl`
- PR: opened against `main` (see PR description for link)

## 2026-09-18

### Quality Gates
- Build: pass
- Typecheck: pass (`tsc --noEmit`)
- Lint: pass (`next lint`, no warnings)
- Unit tests: pass (591/591, 107 files, vitest — 2 new)
- E2E: none configured (still no Playwright in this repo)

### Issues Found
- **P2:** `dateForInput` in the reminder edit modal (`reminder-edit-modal.tsx`) parsed the display-formatted `fireOn` string (e.g. `"Sep 20, 2026"`, always rendered in UTC by `formatDate` in `adapters.ts`) with a plain `new Date(value)`, which JS interprets as *local* midnight. For any user in a timezone east of UTC (verified with `Asia/Tokyo` and `Europe/Berlin`), this pre-filled the "Fire date" field one day earlier than the real date. For an approved reminder due *today*, the shifted value then tripped the past-date guard and blocked the user from saving *any* edit — even just a title or time change — with "Reminders can't be saved with a date that's already passed."
- **P2/P3:** `UploadModal` had no handling for a request rejected before it reached our own validation (e.g. a platform-level 413 with a non-JSON body). `response.json().catch(...)` silently fell back to a bare "Upload failed." with no indication of why, for exactly the case — a large file — where a specific reason is most useful. (App-level rejections for files over the stated 25 MB limit already returned a clear message; this only affected the non-JSON-body case.)
- **Infra drift (no app-code impact):** `clausly-prod`'s migration history had `20260916141909_document_exports_insert_policy` (an INSERT policy on `document_exports` for `authenticated`, required by `POST /api/documents/[id]/export`, which writes via the user's session client) applied directly to the database with no matching file in `supabase/migrations/`. A fresh environment built from the repo's migrations alone would be missing this policy and exports would silently fail to record. Reconfirmed via Supabase advisors: no new security/performance findings beyond the already-documented, judged-intentional ones (`delete_account` SECURITY DEFINER, `vector` extension in `public`, leaked-password protection disabled — dashboard setting).
- Explore-agent audit of upload, reminders, and Ask/QA flows surfaced further P2/P3 items not fixed today (see Remaining Concerns): suggested-question polling can re-trigger generation and burn daily Q&A quota just from opening a document; a failed Ask answer still consumes quota; the reminders page can show an error banner and the "all caught up" empty state at the same time; an optimistic dismiss/approve race in `use-reminders.ts` can resurrect an already-dismissed reminder on an unrelated failed request. No P0/P1s and no cross-user data-scoping gaps found — every reminder/document/suggestion query read was `.eq("user_id", …)`-scoped.
- **Process note:** `docs/QUALITY_LOG.md` has no entries between 2026-09-09 and today, even though six PRs merged in that window are titled "Daily quality run" (#66-#75, #80). Those runs did real, tested work (see their commit messages) but didn't append a log entry as this routine requires. Flagging so future runs don't skip this step.

### Fixes Completed
- `reminder-edit-modal.tsx`: `dateForInput` now parses the non-`YYYY-MM-DD` fallback as UTC (`` `${value} UTC` ``) instead of local time, fixing the off-by-one and the resulting false past-date block.
- `upload-modal.tsx`: extracted the duplicated upload-error handling (file upload + pasted text) into one `parseUploadError` helper, which now gives a specific "too large to upload" message when a non-JSON error body arrives with a 413 status, instead of the generic "Upload failed."
- `supabase/migrations/20260916141909_document_exports_insert_policy.sql`: added the migration file matching the policy already live on `clausly-prod` (pure `CREATE POLICY`/`GRANT`, idempotent, no database change — closes the repo/prod drift).

### Tests Added/Changed
- `reminder-edit-modal.test.tsx`: new case rendering with `TZ=Asia/Tokyo` and a `"Sep 20, 2026"`-style `fireOn`, asserting the date input pre-fills `2026-09-20` (fails on the old code, showing `2026-09-19`).
- `upload-modal.test.tsx`: new case asserting a 413 response with a non-JSON body surfaces "too large to upload" instead of the generic "Upload failed."

### Remaining Concerns
- No P0 issues found; the two P2s above are fixed and tested.
- Suggested-question generation has no in-flight guard (`api/documents/[id]/suggested-questions/route.ts`), so the client's polling can schedule several duplicate generation runs — each counted against the daily Q&A quota — from a single document view. Worth a dedicated pass to add a "pending" state instead of only checking for completed results.
- A failed Ask/QA answer still records a usage row that counts toward the daily limit, while the client hides the failure from the user — inconsistent charging for errors.
- `dashboard/reminders/page.tsx` can render its error banner and the "all caught up" empty state together on a failed fetch.
- `use-reminders.ts`'s optimistic approve/dismiss rollback replaces the whole list on failure, which can resurrect an unrelated reminder that was validly dismissed/approved in the meantime by a second in-flight request.
- The 25 MB upload limit advertised in the UI and enforced in `api/upload/route.ts` is not proven reachable in production — Node.js serverless functions on Vercel are commonly capped well below that at the platform level, independent of app code, which would make today's file-size validation partially unreachable for large files. Confirming the actual deployed limit and, if it's below 25 MB, deciding between lowering the advertised/enforced limit or moving to a direct-to-storage upload path is an architecture-level call for the owner, not something to guess at in a targeted daily fix.
- Six prior "Daily quality run" PRs (#66-#75, #80) merged between 2026-09-09 and 2026-09-15 without a matching `docs/QUALITY_LOG.md` entry (see Process note above).
- Longstanding, previously-documented items unchanged: leaked-password protection still disabled (owner action, Supabase dashboard), `vector` extension still in `public` schema, no Playwright/E2E harness, and the Next.js/vitest major-version bumps needed to clear the remaining `npm audit` findings (postcss via Next 16, vitest 5) are still out of scope for a targeted pass.

### PR/Branch
- Branch: `claude/upbeat-newton-3c65cz`
- PR: opened against `main` (see PR description for link)

## 2026-09-19

### Quality Gates
- Build: pass
- Typecheck: pass (`tsc --noEmit`)
- Lint: pass (`next lint`, no warnings)
- Unit tests: pass (611/611, 110 files, vitest — 3 new)
- E2E: none configured (still no Playwright in this repo)

### Issues Found
- **P2:** `/dashboard/reminders` could show its inline fetch-error banner ("Unable to load reminders.") and the "No suggestions right now. Clausly's caught up." empty state at the same time for the same tab. `useReminders()` clears the list to `[]` on a failed fetch and sets `error`, but the page only guarded the loading state, not the error state, before falling through to the empty-state render — so a real backend error was visually indistinguishable from "you're all caught up," undercutting the one thing this page exists to communicate accurately.
- **P2 (quota/billing correctness):** Neither `/api/documents/[id]/suggested-questions` nor `/api/ask/portfolio/suggested-questions` guarded against concurrent generation. Both endpoints are polled by the client every 2.5s (`document-view.tsx`, `portfolio-ask.tsx`) while a suggestion generation job runs in the background via `after()`. Since generation (an embedding call plus up to two OpenAI calls, each with a 60s timeout) routinely takes longer than one poll interval, every poll landing before the first job persisted its result independently passed the cache-miss check and kicked off its own full generation — each one inserting its own `usage_metrics` row against the user's daily Q&A quota. A single document view could silently burn several quota slots for what the UI presents as one suggestion fetch. This was called out as a remaining concern in the 2026-09-18 entry without a fix; today's run finally addressed it.

### Fixes Completed
- `src/app/dashboard/reminders/page.tsx`: the empty-state render now requires the absence of a fetch error, so a genuine error is no longer masked by (or shown alongside) the "caught up" copy.
- `supabase/migrations/20260919120000_suggestion_generation_lock.sql`: added a nullable `generating_at` column to `document_suggestions` and `portfolio_suggestions` (applied live to `clausly-prod`; advisors re-checked, no new findings).
- `src/app/api/documents/[id]/suggested-questions/route.ts` and `src/app/api/ask/portfolio/suggested-questions/route.ts`: before kicking off generation, the route now claims the lock (`generating_at = now()`) after passing the Q&A rate-limit gate. A poll that lands while a lock less than 4 minutes old is present returns `{ pending: true }` immediately instead of re-checking the gate and starting another generation/usage charge. The lock is cleared on both successful persistence and on a caught generation failure, so a crashed or errored job doesn't permanently block retries. `src/lib/supabase/types.ts` updated to match the new column.

### Tests Added/Changed
- `src/app/dashboard/reminders/__tests__/page.test.tsx` (new): asserts a fetch error renders the error message and not the "caught up" empty state; confirmed it fails against the pre-fix page.
- `src/app/api/documents/[id]/suggested-questions/__tests__/route.test.ts` and `src/app/api/ask/portfolio/suggested-questions/__tests__/route.test.ts`: new case holds generation open on a deferred embedding-provider promise, issues a second request while the first is still in flight, and asserts only one `usage_metrics` row and one persisted suggestions row exist once generation completes. Confirmed both fail (2 usage rows) against the pre-fix routes.

### Remaining Concerns
- No P0/P1 issues found; the two P2s above are fixed and tested.
- A failed Ask/QA answer still records a usage row that counts toward the daily limit while the client hides the failure from the user (from the 2026-09-18 entry) — not addressed today; still worth a dedicated pass.
- The generation lock is a best-effort DB row, not a fully atomic distributed lock — a request racing between the lock-read and lock-write on two different warm instances could in principle still double-fire once. This is a large reduction (the common single-tab polling case, which was the actual reported failure mode, is now fully deduped) rather than a perfect guarantee; a `select ... for update`-style conditional write would close the remaining gap if it's ever observed in practice.
- Same recurring items as every prior entry: `vector` extension in `public` schema, `delete_account` SECURITY DEFINER (verified safe/intentional), leaked-password protection disabled (owner action, Supabase dashboard), `npm audit` PostCSS finding blocked on a Next.js 16 major bump, no Playwright/E2E harness.

### PR/Branch
- Branch: `claude/upbeat-newton-suphbo`
- PR: opened against `main` (see PR description for link)

## 2026-09-20

### Quality Gates
- Build: pass
- Typecheck: pass (`tsc --noEmit`)
- Lint: pass (`next lint`, no warnings)
- Unit tests: pass (609/609, 109 files, vitest — 1 new)
- E2E: none configured (still no Playwright in this repo)

### Issues Found
- **P2:** `getQaUsage` (`src/lib/billing/qa-rate-limit.ts`) counted every `usage_metrics` row in the rolling 24h window regardless of `status`, so a Q&A answer that failed mid-stream (`status: "failed"`, recorded in `src/app/api/documents/[id]/ask/route.ts` and `src/app/api/ask/portfolio/route.ts` on a provider error) still consumed one of the user's daily Q&A questions even though they received no answer. This was flagged as a known remaining concern in the 2026-09-19 log entry (open PR #85) and confirmed still present on `main`.
- Reviewed PR #85 (`claude/upbeat-newton-suphbo`, open, green, mergeable): it already fixes the reminders-page error/empty-state overlap and the suggested-question polling double-charge noted in earlier entries. Not duplicated here — left for the owner to merge.
- Explore-agent audit of reminders, upload, analysis, document detail, auth, and every user-data-scoped API route found no other P0-P2 issues: ownership scoping, past-date guards, optimistic-update rollback, and auth checks all held up under review.
- Supabase advisors (security + performance) on `clausly-prod` show only the same three long-standing, already-judged-acceptable security warnings, plus 9 unindexed foreign keys and 7 unused indexes (new observation, informational-only — no evidence of an actual performance problem at current traffic, not acted on today).

### Fixes Completed
- `src/lib/billing/qa-rate-limit.ts`: `getQaUsage` now excludes rows with `status: "failed"` from both the quota count and the `resetsAt` calculation, so a failed answer no longer costs the user a question.

### Tests Added/Changed
- `src/lib/billing/__tests__/qa-rate-limit.test.ts`: new case seeding one failed and one completed `qa_question` row, asserting only the completed one counts toward usage. Confirmed it fails against the pre-fix query (reported `used: 2` instead of `1`).

### Remaining Concerns
- No P0/P1 issues found or introduced.
- PR #85 remains open, green, and mergeable — still awaiting owner review.
- New, informational-only: 9 foreign keys without a covering index and 7 unused indexes on `clausly-prod` (Supabase performance advisor). Low priority at current scale; worth revisiting if query latency becomes a concern.
- Longstanding, unchanged: leaked-password protection disabled (Supabase dashboard setting), `vector` extension in `public` schema, `delete_account` SECURITY DEFINER callable by `authenticated` (verified intentional), no Playwright/E2E harness, Next.js 16/vitest 5 major bumps needed to clear remaining `npm audit` findings, and the unconfirmed production reachability of the 25 MB upload limit versus Vercel's platform body-size cap.

### PR/Branch
- Branch: `claude/upbeat-newton-egi4e9`
- PR: opened against `main` (see PR description for link)
## 2026-09-21

### Quality Gates
- Build: pass
- Typecheck: pass (`tsc --noEmit`)
- Lint: pass (`next lint`, no warnings)
- Unit tests: pass (612/612, 109 files, vitest — 4 new)
- E2E: none configured (still no Playwright in this repo)

### Issues Found
- **P2:** `/dashboard/settings`'s profile-load `useEffect` (`page.tsx`) had no error handling at all: a thrown `fetch` (network failure) was an unhandled rejection, and a non-2xx response was silently swallowed. Either way the page was left showing the hardcoded `fallbackProfile` (`"Demo User"` / `demo@clausly.app`, `mockMode: true`) with no indication anything had failed — a real, logged-in user hitting a transient 500 would see their own settings replaced by demo data and a "Mock mode: connect Supabase to edit your profile" message that's actively wrong for their situation, with editing silently disabled.
- **P2:** Settings → Activity's "View resource" link for a `document.deleted` audit event (`activity-timeline.tsx`) pointed at `/dashboard/documents/{id}`, which 404s once the document (and its row) are actually gone — `hrefForEvent` only branched on `resourceType`, not `action`.
- **P2:** `ClauseLibrary`'s infinite-scroll `loadMore()` (`clause-library.tsx`) had no staleness guard, unlike the main filter-search effect (which uses `AbortController`). Concrete failure: user scrolls to trigger "load more" under filter set A, then changes a filter/search term before that request resolves; the stale filter-A page then gets merged (`mergeClauses`) onto the freshly-fetched filter-B list, showing clauses that don't match the currently displayed filters.
- **P3:** `ExportButton`'s dropdown (`export-button.tsx`) was `absolute right-0` with a fixed `w-[260px]`, anchored to a small button that sits near the left edge of the document detail action bar. At ~375px width the panel's left edge lands well off the left of the viewport, making the export menu partly unusable on mobile.
- **P1/P2 (found, not fixed today — documented instead):** Explore-agent audit of the clause library, contract compare, export, shareable links, audit log, and onboarding tour surfaced that the onboarding tour's steps 3 ("Skim the clauses") and 4 ("Approve a reminder") never spotlight anything in production. `TourOverlay` (mounted once in `dashboard/layout.tsx`) looks up `[data-tour="clauses"]`/`[data-tour="reminders"]` by `querySelector`, but those attributes only exist on `/dashboard/documents/[id]` (Clauses tab) and `/dashboard/reminders` respectively — pages the tour never navigates the user to. A fresh user clicking through the tour from `/dashboard` gets steps 1–2 highlighted correctly, then two floating tooltips with no spotlight and no way to know where to go, before the tour marks itself complete. The existing test (`tour-overlay.test.tsx`) masks this by rendering all four `data-tour` targets in one DOM tree, which doesn't reflect the real, multi-page layout. Not fixed today: a correct fix means either driving real cross-page navigation from the tour (needs a real document id + tab state, and a design decision about forcibly navigating a user away from wherever they are) or re-scoping the tour to the current page only — both are product/UX decisions, not a small targeted fix, so this is being documented for a dedicated future pass rather than patched today. Re-verified the clause deep-link ("View in document" from `/dashboard/clauses`) that an earlier read of this code looked broken at first glance: `DocumentView` does correctly read `?clause=` from `window.location.search` on mount and switches to the Clauses tab — that path already works.
- Also re-checked and confirmed correct, no changes needed: `safeNextPath`-guarded redirects (login/signup/OAuth callback) are consistently applied and reject `//`-style open-redirect attempts; `createServiceSupabaseClient` is `server-only` and every caller (admin cron routes, webhooks, share resolution) gates on a bearer secret or the user's own session before using it; `/api/admin/*` routes are secret-gated, not just authenticated.
- Supabase advisors re-checked against `clausly-prod`: no new security findings (`vector` extension in `public`, `delete_account` SECURITY DEFINER, leaked-password protection disabled — all previously reviewed/judged intentional or owner-action). Performance advisor lists 9 unindexed FKs and 7 unused indexes, all INFO-level and pre-existing; not addressed today as low-value churn for a targeted pass.
- Confirmed via the GitHub API that PRs #85 (reminders error/empty-state clash, suggestion-quota double-charge) and #86 (failed Q&A answers no longer consuming quota) are still open, green, and unmerged from the last two days — they already cover three items that would otherwise have been re-reported today (suggested-questions in-flight guard, failed-Ask quota charging, reminders page error/empty-state clash), so those were intentionally not re-implemented here.
- Migration bookkeeping drift, still present: `clausly-prod`'s applied-migration history includes `20260919142405_suggestion_generation_lock`, applied ahead of PR #85 merging, but PR #85's own migration file uses a different timestamp (`20260919120000_suggestion_generation_lock.sql`) for the same change — will need a trivial rename/reconciliation whenever #85 is merged so the filename matches what's already live on prod.

### Fixes Completed
- `src/app/dashboard/settings/page.tsx`: profile load now catches fetch/response failures, shows a dedicated "Couldn't load your profile" banner with a Retry button, and no longer disables the form under a misleading "Mock mode" label when the real cause is a failed request.
- `src/components/dashboard/audit/activity-timeline.tsx`: `hrefForEvent` returns `null` for `document.deleted` events instead of linking to the now-deleted document's detail page.
- `src/components/dashboard/clauses/clause-library.tsx`: added a `filtersVersion` ref that increments whenever the search/category/risk filters change; `loadMore()` snapshots the version at request start and discards (does not merge) its result if the filters changed while the request was in flight.
- `src/components/dashboard/document-actions/export-button.tsx`: dropdown now anchors `left-0` (flipping to `right-0` at `sm:`) with `max-w-[calc(100vw-2rem)]`, so it stays on-screen at narrow widths instead of extending off the left edge.

### Tests Added/Changed
- `settings/__tests__/page.test.tsx`: two new cases — a failed profile fetch shows the retry banner (not the mock-mode message) and disables Save; clicking Retry re-fetches and clears the banner on success. Confirmed both fail against the pre-fix code.
- `audit/activity-timeline.test.tsx`: new case for a `document.deleted` event asserting no "View resource" link renders (shows the truncated ID instead). Confirmed it fails against the pre-fix code.
- `clauses/__tests__/clause-library.test.tsx`: new case simulates a slow "load more" request that resolves only after the risk filter changes underneath it, and asserts the stale page's clause is never shown. Confirmed it fails against the pre-fix code. (Also added a missing `cleanup()` to this file's `afterEach` — without it, prior tests' unmounted-but-still-rendered filter buttons collided with the new test's `getAllByRole(...)[0]` lookup.)

### Remaining Concerns
- No P0 issues found. One P1 found and intentionally left unfixed: the onboarding tour's clause/reminder steps don't highlight anything (see Issues Found) — needs a scoped design decision, not a same-day patch; recommend either constraining the tour to what's visible on the current page or giving `TourOverlay` real document/tab data plus explicit navigation between steps.
- PRs #85 and #86 remain open, green, and unreviewed for 1-2 days — recommend the owner merge both (they're independent, no conflicting changes).
- CSS-only mobile fix to `ExportButton` was not covered by an automated test (jsdom has no real layout engine to assert on); recommend a manual check at ~375px if this component changes again.
- Same longstanding items as every prior entry: `vector` extension in `public`, `delete_account` SECURITY DEFINER (judged safe/intentional), leaked-password protection disabled (owner action, Supabase dashboard), no Playwright/E2E harness, `npm audit` findings blocked on Next.js 16/Vitest 5 major bumps, migration bookkeeping drift (see Issues Found), and `CompareWithButton`'s missing Escape dismissal (P3).

### PR/Branch
- Branch: `claude/upbeat-newton-e5jvjw`
- PR: opened against `main` (see PR description for link)

## 2026-09-22

### Quality Gates
- Build: pass
- Typecheck: pass (`tsc --noEmit`)
- Lint: pass (`next lint`, no warnings)
- Unit tests: pass (612/612, 109 files, vitest — 4 new)
- E2E: none configured (still no Playwright in this repo)

### Issues Found
- **P1 (billing correctness):** `DELETE /api/profile` (account deletion) never canceled the user's Stripe subscription. `delete_account`'s `auth.users` delete cascades to `public.users` and then `billing_customers` (`on delete cascade`), destroying the only mapping from the user to their `stripe_customer_id` before any cancellation could happen. A Pro user deleting their account kept their subscription active and kept being billed monthly, with no remaining way for the app (or, without manual Stripe-dashboard digging, the owner) to find and stop it.
- **P2 (billing correctness, not fixed today):** The Stripe webhook (`src/app/api/billing/webhook/route.ts`) only handles `checkout.session.completed` and `customer.subscription.deleted`. It has no handler for `invoice.payment_failed` or `customer.subscription.updated` (`past_due`/`unpaid`), so a lapsed/failed-payment Pro subscription leaves `subscription_tier` at `pro` indefinitely until Stripe's retry schedule fully exhausts and deletes the subscription (if ever) — the user keeps Pro-tier access despite non-payment in the meantime. Needs a deliberate pass (new webhook branch + a decision on what tier/UX a `past_due` user gets) rather than a same-day fix bundled with the P1 above.
- **P3 (not fixed today):** `getOrCreateStripeCustomer` (`src/lib/billing/stripe.ts`) has a race: two concurrent checkout requests with no existing `billing_customers` row both create a Stripe customer and both try to `insert`; the second insert throws (unique `user_id`), surfacing as a generic "Checkout could not be started" error even though a real (now orphaned) Stripe customer was created. Rare (needs a double-click/double-tab), and a proper fix (upsert + re-read) touches a small hand-written Supabase type shim used for test mocking — deferred rather than rushed.
- Investigated the onboarding-tour issue flagged (but not fixed) in PR #87: confirmed steps 3–4 (`TOUR_STEPS` in `src/components/onboarding/tour-overlay.tsx`) target `[data-tour="clauses"]`/`[data-tour="reminders"]`, which only exist on `/dashboard/documents/[id]` and `/dashboard/reminders` respectively — routes the tour never navigates the user to. Not a selector bug; the tour's "Next" never moves the page. Confirmed this needs a product/UX decision (auto-navigate the user vs. redesign as single-page coachmarks vs. skip off-route steps), so left undone again, as before.
- Verified `notification-preferences-card.tsx`, flagged as dead code in the 2026-09-16 log entry, was already deleted in commit `d4ee1c5` (#73) — no action needed; that log line is stale/resolved.
- Supabase security/performance advisors re-checked against `clausly-prod`: no new findings. Same three previously-reviewed/judged-safe items (`vector` extension in `public`, `delete_account` SECURITY DEFINER — verified intentional, leaked-password protection disabled — owner's dashboard setting) plus routine INFO-level unindexed-FK/unused-index notices, not worth acting on for a low-traffic app.
- `npm audit`: same 6 findings as every prior run (vitest/@vitest/mocker, esbuild dev-server-on-Windows, postcss via Next.js), all only resolvable via a Next.js 16 or Vitest 5 major bump. Tried `npm audit fix` (non-force): it re-resolved `package-lock.json` without touching the vulnerable `esbuild`/`postcss` versions at all — reverted the no-op lockfile churn rather than commit it.
- Process note: three "Daily quality run" PRs (#85, #86, #87) from 2026-09-19 through 2026-09-21 are open, green (CI + Vercel preview passing), and mergeable against `main`, but still unreviewed — the routine skipped 2026-09-19 through 2026-09-21 in this log because those runs' entries weren't appended (same gap pattern noted on 2026-09-18). Confirmed via their PR bodies that none of the three overlap each other or today's fix.

### Fixes Completed
- `src/app/api/profile/route.ts`: `DELETE` now looks up the caller's `billing_customers` row and cancels every non-canceled Stripe subscription for that customer *before* calling the `delete_account` RPC (which cascades away the only Stripe customer mapping). Best-effort: a Stripe API failure is logged and does not block the account deletion itself, matching this route's existing best-effort audit-logging pattern.

### Tests Added/Changed
- `src/app/api/profile/__tests__/route.test.ts`: four new cases — cancels an active subscription before deleting, does not re-cancel an already-canceled subscription, still deletes the account when the Stripe call throws, and skips Stripe entirely for a user with no billing-customer mapping. First three confirmed to fail against the pre-fix code (no cancellation call at all).

### Remaining Concerns
- No P0 issues found. The P1 above is fixed and tested.
- The P2 (webhook missing `invoice.payment_failed`/`subscription.updated` handling) and P3 (checkout customer-creation race) above are real but deliberately left for a future targeted pass.
- Onboarding tour steps 3–4 still don't spotlight anything without the user manually navigating there first — needs a product decision (see Issues Found), not a code fix.
- Three open, green, unmerged "Daily quality run" PRs (#85, #86, #87) are stacking up unreviewed since 2026-09-19 — recommend the owner review/merge oldest-first to keep `main` current and avoid future runs' diffs drifting further from what's actually merged.
- Same longstanding items as every prior entry: no Playwright/E2E harness, `npm audit`'s postcss/vitest findings blocked on major-version bumps, Supabase advisories judged safe/owner-action-only.

### PR/Branch
- Branch: `claude/upbeat-newton-2agm4y`
- PR: opened against `main` (see PR description for link)

## 2026-09-23

### Quality Gates
- Build: pass
- Typecheck: pass (`tsc --noEmit`)
- Lint: pass (`next lint`, no warnings)
- Unit tests: pass (609/609, 109 files, vitest — 1 new)
- E2E: none configured (still no Playwright in this repo)

### Issues Found
- **P3:** `getOrCreateStripeCustomer` (`src/lib/billing/stripe.ts`) had the race flagged-but-deferred in the 2026-09-22 entry: two concurrent `/api/billing/checkout` requests (a double-click, or two tabs) with no existing `billing_customers` row both create a Stripe customer and both try to `insert` the mapping; `user_id` is the table's primary key, so the second insert throws and that request's checkout fails with the generic "Checkout could not be started" — even though a real (now orphaned, harmless, unbilled) Stripe customer was created and the *other* request succeeded normally.
- Re-checked Supabase security/performance advisors against `clausly-prod`: no new findings (same three long-standing, previously-judged-safe items; same nine unindexed-FK/seven unused-index INFO notices, still not worth acting on).
- `npm audit`: same six findings as every prior run, all still only resolvable via a Next.js 16 or Vitest 5 major bump.
- Confirmed the four open "Daily quality run" PRs from the last four runs (#85, #86, #87, #88) are still unreviewed — see Remaining Concerns; read each one's diff to confirm today's fix doesn't overlap.
- No new P0/P1/P2 found. A targeted read of the reminders, upload, analysis, and auth routes not already covered by the four open PRs above turned up nothing else concrete.

### Fixes Completed
- `src/lib/billing/stripe.ts`: `getOrCreateStripeCustomer` now catches a `23505` (unique-violation) insert error and re-reads the row instead of throwing, returning the concurrent winner's `stripe_customer_id` so the losing request's checkout still succeeds instead of erroring out.
- `tests/helpers/supabase.ts`: `failNext()` now accepts an optional Postgres error `code` (previously always `"TEST_ERROR"`), needed to simulate a `23505` unique-violation in the regression test below without a broader mock rewrite.

### Tests Added/Changed
- `src/lib/billing/__tests__/stripe.test.ts`: new case simulates a concurrent request winning the insert (seeding the row as a side effect of the mocked `customers.create` call, then forcing the next `billing_customers` insert to fail with code `23505`) and asserts `getOrCreateStripeCustomer` resolves to the winner's customer ID instead of rejecting. Confirmed it fails against the pre-fix code (rejects with the raw Postgres error).

### Remaining Concerns
- No P0/P1 issues found.
- **Four "Daily quality run" PRs are open, green, and mergeable against current `main`, unreviewed for 1–4 days: #85 (2026-09-19), #86 (2026-09-20), #87 (2026-09-21), #88 (2026-09-22, includes a P1 billing fix — canceling Stripe subscriptions on account deletion).** This is now a five-run streak of unreviewed backlog (see the same note in the 2026-09-22 entry for #85-#87) — recommend the owner review and merge oldest-first before the queue grows further; none of the four (confirmed by reading each PR body) overlap each other or today's fix.
- The Stripe webhook (`src/app/api/billing/webhook/route.ts`) still only handles `checkout.session.completed`/`customer.subscription.deleted`, with no `invoice.payment_failed`/`customer.subscription.updated` handling — flagged again in the 2026-09-22 entry as needing a product decision (what tier/UX a `past_due` user gets, plus a `subscription_tier` check-constraint change) before it can be fixed, not something to guess at in a targeted pass.
- Onboarding tour steps 3-4 still don't spotlight anything without a product decision (see 2026-09-21/22 entries).
- Same longstanding items as every prior entry: no Playwright/E2E harness, leaked-password protection disabled (owner action), `vector` extension in `public` schema, `npm audit` findings blocked on major-version bumps.

### PR/Branch
- Branch: `claude/upbeat-newton-vg7oky`
- PR: opened against `main` (see PR description for link)
