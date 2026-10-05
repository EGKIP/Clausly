# Track M7 — Security & privacy review

- **Depends on:** M1, M3
- **Parallel with:** ∥

## Goal
See `docs/mobile/PLAN.md` §4 for how this track fits.

## Tasks
- Verify no service-role/secret in the bundle; tokens only in Keychain; ATS/TLS; privacy manifest; logs contain no document content or tokens.
- Prove RLS holds with a mobile JWT (cross-user tests on every table the app reads).
- Verify account deletion removes storage objects and rows; shared-link behavior unchanged.

## Acceptance
Written findings in docs/mobile/SECURITY_REVIEW.md; any P0/P1 fixed before M8.

## Ground rules
Read `docs/mobile/PLAN.md` §5 first. Branch: `claude/mobile-security`. One PR, human-reviewed;
never merge. Never weaken RLS, never ship a service-role key to a client, mutations go
through existing API routes, keep legal-information disclaimers, update
`docs/QUALITY_LOG.md` for behavior changes. If you hit an undecided question, add it to
`docs/mobile/PLAN.md` §3 instead of guessing.
