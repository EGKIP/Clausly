# Track M2 — Shared contract package

- **Depends on:** M0
- **Parallel with:** ∥ M1

## Goal
See `docs/mobile/PLAN.md` §4 for how this track fits.

## Tasks
- Move/mirror zod schemas from `src/lib/validation` and DB types into `packages/shared`; web imports from it.
- Typed API client (fetch wrapper, error shape, auth injection).
- Add `X-Clausly-Client` header handling and `GET /api/client-config` → `{ minSupportedVersion }`.
- Contract tests: each route's success/error JSON validates against the shared schemas.

## Acceptance
Web unchanged and green; shared package published to the workspace; contract tests run in CI.

## Ground rules
Read `docs/mobile/PLAN.md` §5 first. Branch: `claude/mobile-shared-contract`. One PR, human-reviewed;
never merge. Never weaken RLS, never ship a service-role key to a client, mutations go
through existing API routes, keep legal-information disclaimers, update
`docs/QUALITY_LOG.md` for behavior changes. If you hit an undecided question, add it to
`docs/mobile/PLAN.md` §3 instead of guessing.
