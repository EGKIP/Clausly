# Track M0 — Architect: workspace + decisions

- **Depends on:** D1 answered
- **Parallel with:** —

## Goal
See `docs/mobile/PLAN.md` §4 for how this track fits.

## Tasks
- Update ADR-0002..0004 status to match the owner's answers to D1–D4.
- Add npm workspaces (`packages/*`, `mobile`) **without moving web**; confirm `npm ci`, `next build`, and Vercel settings are unchanged.
- Create empty `packages/shared` (TypeScript, builds, has a test runner) wired into CI.

## Acceptance
`npm run build`, lint, typecheck, tests all pass; web output byte-for-byte unaffected; CI runs shared tests.

## Ground rules
Read `docs/mobile/PLAN.md` §5 first. Branch: `claude/mobile-architect`. One PR, human-reviewed;
never merge. Never weaken RLS, never ship a service-role key to a client, mutations go
through existing API routes, keep legal-information disclaimers, update
`docs/QUALITY_LOG.md` for behavior changes. If you hit an undecided question, add it to
`docs/mobile/PLAN.md` §3 instead of guessing.
