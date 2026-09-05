# Quality Log

Daily autonomous quality and maintenance runs for Clausly. Entries are appended, not rewritten.

---

## 2026-09-05

**Quality Gates**
- Build: Pass
- Typecheck: Pass (`tsc --noEmit`, no errors)
- Lint: Pass (`next lint`, no warnings/errors)
- Unit tests: Pass (524/524, 97 files)
- E2E: Not present in repo (no Playwright config found); relied on unit/integration tests plus manual code review of core flows instead

**Issues Found**
- `npm audit` reported 6 high-severity advisories, most rooted in Next.js 15.5.18 bundling vulnerable transitive `nanoid`/`sharp`/`postcss`, including Server Actions DoS/SSRF and cache-confusion CVEs (P2 — no known exploitation, but a real hardening gap for a document-upload app).
- Minor: `sendWelcomeEmailOnceForUser` (`src/lib/notifications/welcome.ts`) sends the welcome email before persisting the `welcome_email_sent_at` marker; if the marker update fails after a successful send, a later login retries and could send a duplicate welcome email. Low impact (no data exposure, cosmetic duplicate email), not fixed this run — flagged for a future pass.
- Minor/cosmetic: the notifications dispatch test mock doesn't seed an `audit_events` table, so `recordAuditEvent` throws internally on every reminder-dispatch test (caught and swallowed by design, per `logAuditEvent`'s best-effort contract). Produces noisy `console.warn` output in test runs but no functional issue.

**Fixes Completed**
- Ran `npm audit fix` (no `--force`) to bump `next` 15.5.18 → 15.5.25 (patch release, unchanged `^15.5.18` range in package.json) plus transitive `sharp`/`nanoid` bumps, resolving 4 of 6 high-severity advisories including the Server Actions DoS/SSRF and Image Optimization DoS issues. Verified lint, typecheck, full unit test suite, and production build all remained green after the bump.
- Remaining `postcss` advisory is nested inside `next@15.5.25`'s own dependency tree and only clears with a `next@16` major upgrade (`npm audit fix --force`); deferred as out of scope for a targeted daily fix (see Remaining Concerns).

**Tests Added/Changed**
- None. Existing coverage (524 unit/integration tests, including `tests/integration/rls-isolation.test.ts` for cross-tenant isolation) was exercised and confirmed passing; no code behavior changed that required new tests.

**Remaining Concerns**
- Next.js 16 major upgrade would close the last `postcss` advisory but is a breaking change requiring its own review/testing pass — not attempted today.
- No Playwright/E2E harness exists yet, so browser-level regression coverage (mobile viewport, modal focus traps, upload UX) still depends on manual review; worth a future investment given the number of interactive flows (upload, reminders, ask).
- Welcome-email duplicate-send edge case above is unresolved (low priority).

**PR/Branch**
- Branch: `claude/upbeat-newton-n7vuxl` (this session's working/stabilization branch)
- No PR opened by a prior run for this branch.
