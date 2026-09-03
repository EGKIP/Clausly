# Clausly Quality Log

Daily entries from the autonomous quality/maintenance routine. Newest first. Entries are not rewritten after the fact.

---

## 2026-09-03

### Quality Gates
- Build: pass
- Typecheck: pass (`tsc --noEmit`)
- Lint: pass (`next lint`, 0 warnings/errors)
- Unit tests: pass (98 files, 527 tests)
- E2E: none configured in this repo (no Playwright/browser-automation setup exists yet; core flows are covered by vitest + Testing Library component/integration tests instead)

### Issues Found
- **P2** — Dashboard document list didn't refresh after a successful upload unless the user clicked "Open document" in the upload modal. Closing via the X button, backdrop click, or Cancel left the new document invisible in `/dashboard/documents`, `/dashboard/reminders`, and the command palette until a manual page reload, even though the document existed server-side. (`src/components/dashboard/upload-modal.tsx`, `src/lib/hooks/use-documents.ts`)
- **P3** — `POST /api/reminders` looked up the target document by id without also filtering by `user_id`. Not independently exploitable today (the route uses the RLS-respecting client and the `documents` select policy already restricts rows to `auth.uid() = user_id`, so a cross-user id resolves to "not found"), but it was inconsistent with every other route in the codebase, which all filter explicitly. (`src/app/api/reminders/route.ts`)
- **P3 (informational, not fixed)** — `getDocumentDetail`, `listDocuments`, and `listDocumentRows` in `src/lib/db/documents.ts` rely entirely on RLS for tenant isolation rather than an explicit `user_id` filter, unlike the sibling PATCH/DELETE handlers on the same routes. RLS is verified correct and this is not a live gap, but adding explicit filters would require threading `user.id` through 5+ call sites (dashboard, compare, insights, document detail pages) — out of proportion to the actual risk, so left as-is and documented here rather than refactored.
- **Supabase security advisor**: `public.delete_account(uuid)` currently has EXECUTE granted to `anon`/`PUBLIC` in production, contradicting the original migration's explicit `revoke ... from public`. The function's own `auth.uid()` check already blocks anonymous callers, so this isn't exploitable, but the live grant state has drifted from the migration's intent. Also: `handle_new_user` had an unnecessary direct EXECUTE grant (only ever invoked via trigger), and three functions (`set_updated_at`, `match_document_chunks`, `match_portfolio_chunks`) had a mutable `search_path`. A fix migration was written but **not yet applied to production** (see Remaining Concerns).
- Also via the advisor: `nanoid`, and Next.js itself, carried 6 combined high-severity CVEs (server-action DoS/SSRF, cache confusion, endpoint disclosure) in the previously-pinned `next@15.5.18`.
- **Migration history drift**: the live database's migration tracking table shows only 1 applied migration (`document_analysis_recovery`) while the repo has 17 migration files spanning the full schema. The schema clearly matches the newer files (tables/functions exist), so migrations were very likely applied outside the tracked `supabase db push` flow — but this means the migration history can't be trusted to reflect what's deployed, and a future `supabase db push` may behave unexpectedly. Flagged for the owner; not something to fix automatically.

### Fixes Completed
- Bumped `next` 15.5.18 → 15.5.25 via `npm audit fix` (in-range patch release on the existing `^15.5.18` semver bound, no breaking changes) — closes the 6 high-severity CVEs above. Also picked up a patched `nanoid`.
- `src/lib/hooks/use-documents.ts`: added a small `clausly:documents-changed` window event + `notifyDocumentsChanged()` helper; `useDocuments()` now refetches whenever it fires.
- `src/components/dashboard/upload-modal.tsx`: calls `notifyDocumentsChanged()` immediately after a successful PDF or pasted-text upload, so every mounted document list (documents page, reminders page, command palette) picks up the new document regardless of how the modal is closed.
- `src/app/api/reminders/route.ts`: added `.eq("user_id", user.id)` to the document ownership check in `POST /api/reminders`, matching the rest of the codebase.
- `supabase/migrations/20260903000100_harden_function_grants.sql`: written (not yet applied — see below) to re-revoke `delete_account` EXECUTE from anon/PUBLIC, drop the unnecessary `handle_new_user` grant, and pin `search_path` on the three flagged functions.

### Tests Added/Changed
- `src/lib/hooks/__tests__/use-documents.test.ts` (new): verifies `useDocuments()` refetches on the `documents-changed` event.
- `src/components/dashboard/__tests__/upload-modal.test.tsx`: added a test asserting the modal fires the change notification after a successful upload.

### Remaining Concerns
- The `20260903000100_harden_function_grants.sql` migration has **not been applied to the production Supabase project**. It's a low-risk, additive privilege-tightening change (no data/schema impact, easily reversible), but applying schema changes to the live production database wasn't done autonomously in this run — it needs the owner's normal deploy step (`supabase db push` or equivalent).
- Migration-history drift (above) is worth the owner's attention independent of today's fix — worth reconciling with `supabase migration repair` or equivalent before the next schema change ships.
- Supabase auth setting "Leaked Password Protection" is disabled project-wide. This is an Auth dashboard/config toggle, not a code or SQL change, so it's left for the owner: Supabase dashboard → Authentication → Policies.
- `npm audit` still reports one high-severity `postcss` advisory nested inside Next.js's own bundled dependency (`next/node_modules/postcss@8.4.31`) and one in `esbuild` (dev-only, via vitest). Both require a Next.js major-version bump (15→16) to clear, which is out of scope for a routine maintenance run per the change-discipline guidance (no unjustified major dependency bumps). No production code path in this app processes attacker-controlled CSS, so risk is low; revisit when a 16.x upgrade is otherwise justified.
- No E2E/browser-automation test suite exists in this repo. Given the app is already unusually well covered by component/integration vitest tests (527 tests across upload, analysis, reminders, auth, billing, sharing), introducing Playwright is a real infrastructure investment (new dependency, CI wiring, browser install) rather than a small fix — flagging as a candidate for a future run rather than doing it opportunistically today.
- Database performance advisor also flagged several unindexed foreign keys and a handful of unused indexes — all `INFO` level, consistent with a low-traffic app, not addressed today (removing "unused" indexes this early would be premature).

### PR/Branch
- Branch: `claude/upbeat-newton-4zc75i`
- Commits: `3b4949e` (next security bump + grants migration), plus the fixes in this entry.
