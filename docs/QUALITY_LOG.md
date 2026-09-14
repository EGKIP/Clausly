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

## 2026-09-14

### Quality Gates
- Build: pass
- Typecheck: pass (`tsc --noEmit`)
- Lint: pass (`next lint`, no warnings)
- Unit tests: pass (552/552, 102 files, vitest — 14 new)
- E2E: none configured (still no Playwright in this repo)

### Issues Found
- **P2 (security, open redirect):** `/login?next=...` only checked `next.startsWith("/")` before rendering it into `AuthCard`, which does `window.location.href = next` immediately after a successful password sign-in. `//evil.test` passes that check but browsers resolve a protocol-relative URL as `https://evil.test`, so a crafted `https://clausly.app/login?next=//evil.test` link sends a victim through a real, legitimate Clausly login and then off to an attacker-controlled site right after — a classic phishing/open-redirect primitive (CWE-601). `/auth/callback` already had the correct `//`-blocking check (`safeNextPath`), so OAuth/magic-link sign-in (which always round-trips through that route) was never affected — only the direct password-login redirect on the login page itself.
- **P2 (functional/self-triggerable 500):** `notification_preferences` is a single JSONB column shared by three independent writers with incompatible key sets: the settings-page toggle endpoint (`src/lib/db/notification-preferences.ts`, keys `email`/`reminders`/`weekly_digest`/`welcome_email_sent_at`) hard-throws on any other key via `assertAllowedStoredKeys`; the Resend bounce/spam-complaint webhook (`src/lib/notifications/webhook.ts`) writes a `version` key into the same column to invalidate old one-click-unsubscribe links; and `/api/profile`'s notification path writes a `defaults` key. Once a real production event (an email bounce, or any direct call to `/api/profile` with a `notification_preferences` body) touched a user's row, that user's next `PATCH /api/settings/notifications` — the live toggle switches on `/dashboard/settings` — threw an uncaught `Error` and 500'd, permanently breaking their notification toggles.
- **P3 (accessibility):** The account-deletion confirmation dialog (`src/app/dashboard/settings/page.tsx`) — the app's most destructive, irreversible action — had no `role="dialog"`/`aria-modal` and no Escape-key close; keyboard users could Tab out into background content and Escape did nothing. `CompareWithButton`'s document picker had correct dialog markup but the same missing Escape handling. Neither has a full focus trap yet (the app's own reference pattern lives in `shell.tsx`'s mobile drawer) — left as a follow-up, not blocking.
- Reviewed billing (`src/app/api/billing/`, `src/lib/billing/`), contract compare, and document sharing end-to-end via a focused sub-review: compare and sharing look solid (per-document/per-token ownership checks, share tokens are `randomBytes(32)`, expired/revoked tokens fail closed). Found one real gap not fixed today: the Stripe webhook only reacts to `checkout.session.completed` and `customer.subscription.deleted` — `customer.subscription.updated` (e.g. a renewal charge going `past_due`) isn't handled, so a user whose card is declined on renewal keeps Pro access indefinitely. Left for a future run since the right behavior (immediate downgrade vs. a grace period) is a product decision, not a pure bug fix.
- Confirmed via Supabase advisors (`clausly-prod`): no new findings since the last run. `delete_account` remains intentionally callable by `authenticated` (enforces `auth.uid()` internally), `vector` extension is still in `public` (low severity, non-trivial migration), and leaked-password protection is still disabled (owner-side Auth dashboard setting, not code).
- `npm audit`: one high/moderate pair, both from `postcss` bundled inside Next.js's own build tooling (`node_modules/next/node_modules/postcss`), fixable only via a Next 16 major bump. Build-time-only exposure (source-map/CSS-stringify parsing during `next build`, not a runtime code path), so not worth the major-version churn today; worth revisiting when a routine Next upgrade is otherwise due.

### Fixes Completed
- Added `src/lib/auth/safe-next-path.ts` (a single shared `safeNextPath` helper) and used it in both `/login` (`src/app/(auth)/login/page.tsx`) and `/auth/callback` (`src/app/auth/callback/route.ts`, replacing its local duplicate of the same check) so a `//`-style protocol-relative redirect target is rejected everywhere `next` is trusted, not just in the one place it happened to already be checked.
- `src/lib/db/notification-preferences.ts`: widened `assertAllowedStoredKeys` to also accept `version` and `defaults` — the two extra keys legitimately written elsewhere in this codebase into the same column — instead of hard-failing the settings-toggle endpoint on them. The guard still rejects genuinely unrecognized keys (existing `sms` test case still passes).
- `src/app/dashboard/settings/page.tsx`: delete-account modal now has `role="dialog"`/`aria-modal`/`aria-labelledby` and closes on Escape (guarded so Escape can't be used to dodge an in-flight delete request).
- `src/components/dashboard/compare/compare-with-button.tsx`: the compare picker now closes on Escape, matching its existing backdrop-click-to-close behavior.

### Tests Added/Changed
- `src/lib/auth/__tests__/safe-next-path.test.ts`: new — same-origin path allowed, missing/absolute/protocol-relative `next` all fall back to `/dashboard`.
- `src/app/(auth)/login/__tests__/page.test.tsx`: new — asserts the exact `next` value `LoginPage` hands to `AuthCard` (the value that ends up in `window.location.href`) is sanitized for `//evil.test`, `https://evil.test`, and a missing `next`.
- `src/app/auth/callback/__tests__/route.test.ts`: added a protocol-relative-URL regression case alongside the existing absolute-URL one.
- `src/lib/db/__tests__/notification-preferences.test.ts`: added cases reproducing the webhook-written `version` key and the profile-endpoint-written `defaults` key no longer crashing `updatePreferences`.
- `src/app/dashboard/settings/__tests__/page.test.tsx`: new — delete-account dialog has `aria-modal` and closes on Escape.
- `src/components/dashboard/compare/__tests__/compare-with-button.test.tsx`: new — compare picker dialog closes on Escape.

### Remaining Concerns
- No P0 issues found. No P1s found or introduced.
- Billing webhook doesn't react to `customer.subscription.updated` (see Issues Found) — needs a product decision on grace-period vs. immediate downgrade before implementing; documented for a future run.
- Neither the delete-account dialog nor the compare picker has a full focus trap yet (Escape-to-close is fixed; Tab can still leave the dialog). `shell.tsx`'s mobile drawer already has the app's correct reference implementation — worth reusing as a shared hook in a future pass instead of re-implementing per-modal.
- `postcss` advisory via Next's bundled build tooling remains open pending a Next 16 upgrade (build-time only, not a runtime risk).
- No E2E/browser test harness exists yet, and this sandbox has no live Supabase credentials, so protected-route/auth behavior was verified by dev-server smoke checks plus code + unit/integration tests, not a live authenticated browser session. Playwright remains a reasonable future investment.

### PR/Branch
- Branch: `claude/upbeat-newton-355qe4`
- PR: opened against `main` (see PR description for link)
