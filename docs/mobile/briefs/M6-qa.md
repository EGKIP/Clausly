# Track M6 — QA & parity

- **Depends on:** M3
- **Parallel with:** ∥

## Goal
See `docs/mobile/PLAN.md` §4 for how this track fits.

## Tasks
- Add a minimal Playwright smoke for the web core journey (parity oracle) if not present.
- Mobile: unit tests + Maestro/Detox smoke (sign in → upload → analysis → approve reminder → sign out).
- Contract tests stay green; accessibility pass; failure injection: offline, expired token, oversized/corrupt file, failed analysis.

## Acceptance
Smoke suites run in CI or a documented one-command local run; defects filed with repro steps and priorities (P0–P4).

## Ground rules
Read `docs/mobile/PLAN.md` §5 first. Branch: `claude/mobile-qa`. One PR, human-reviewed;
never merge. Never weaken RLS, never ship a service-role key to a client, mutations go
through existing API routes, keep legal-information disclaimers, update
`docs/QUALITY_LOG.md` for behavior changes. If you hit an undecided question, add it to
`docs/mobile/PLAN.md` §3 instead of guessing.
