# Clausly Quality Log

Daily entries from the autonomous quality/maintenance routine. Newest entries at the top. Do not rewrite old entries.

---

## 2026-09-07

### Quality Gates
- Build: PASS
- Typecheck: PASS
- Lint: PASS (no warnings)
- Unit tests: PASS (525/525, was 524/524 before adding a regression test)
- E2E: not configured in this repo (no Playwright setup); relied on unit/integration coverage and manual code-level review of core flows instead

### Issues Found
- `reminderLifecycleFieldsSchema.fire_on` (src/lib/reminders/validation.ts) validated the date with a bare `\d{4}-\d{2}-\d{2}` regex, which accepts syntactically well-formed but calendrically invalid dates (e.g. `2026-02-30`, `2026-13-01`). The reminder edit UI uses a native `<input type="date">`, which browsers block from producing such values, so this was only reachable via direct API calls (PATCH `/api/reminders/[id]` or the approve endpoint) — a Postgres `date` column would reject the insert and the route would surface a raw 500 with the database error message instead of a clean 400. Severity: P3 (edge-case API robustness/UX, not reachable through normal UI use, no data loss or security impact).
- No P0/P1 issues found. Reviewed RLS policies (all core tables — documents, clauses, dates, reminders, usage_metrics — have `enable row level security` plus per-action owner-scoped policies), service-role key usage (isolated to `server-only` files: webhooks, cron dispatch, admin routes, public share digest; never touches client bundles), document/reminder API routes (all mutating routes filter by `.eq("user_id", user.id)`), the public share-link path (`getShareByToken` checks `revoked_at` and expiry before returning data), and upload validation (magic-byte file-type sniffing, not just MIME/extension trust, plus a 25MB size cap). All looked correct.

### Fixes Completed
- Replaced the regex-based `fire_on` check with Zod's built-in `z.string().date()`, which validates real calendar dates (leap years included) while keeping the same YYYY-MM-DD format contract. Applies to both the reminder PATCH (edit) and approve endpoints since they share `reminderLifecycleFieldsSchema`.

### Tests Added/Changed
- `src/lib/reminders/__tests__/validation.test.ts`: added a case asserting `fire_on` rejects `2026-02-30` and `2026-13-01` and accepts the valid leap-day `2026-02-28`.

### Remaining Concerns
- No Playwright/E2E harness exists in this repo, so browser-level regression coverage (multi-step flows like upload → analyze → approve reminder) depends entirely on component/unit tests and manual review. Consider adding a minimal Playwright setup in a future run if the owner wants real browser coverage; not done today to avoid an unplanned dependency/tooling change during a routine run.
- Did not attempt live UI/browser testing this run (no Supabase project credentials available in this environment), so verification was via code review + full automated test/build/lint/typecheck suite rather than clicking through the app.

### PR/Branch
Branch: `claude/upbeat-newton-yap617`. PR opened against `main`.
