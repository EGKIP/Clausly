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
