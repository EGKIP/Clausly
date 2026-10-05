# Track M1 — Backend: bearer-token auth

- **Depends on:** ADR-0003 accepted (D3)
- **Parallel with:** ∥ M2

## Goal
See `docs/mobile/PLAN.md` §4 for how this track fits.

## Tasks
- Add `getRouteClient(request)` (bearer if `Authorization: Bearer`, else cookies). Migrate all call sites of `createClient()` under `src/app/api`.
- Auth-failure and ownership behavior must be identical for both paths.
- Tests per route group: cookie ok, bearer ok, no auth → 401, user A cannot touch user B's data (use the existing mock harness incl. `withoutRlsSimulation`).

## Acceptance
No route regresses; every migrated route has a bearer test; grep shows no remaining cookie-only API clients (except cron/webhook routes that use their own auth).

## Ground rules
Read `docs/mobile/PLAN.md` §5 first. Branch: `claude/mobile-backend-auth`. One PR, human-reviewed;
never merge. Never weaken RLS, never ship a service-role key to a client, mutations go
through existing API routes, keep legal-information disclaimers, update
`docs/QUALITY_LOG.md` for behavior changes. If you hit an undecided question, add it to
`docs/mobile/PLAN.md` §3 instead of guessing.
