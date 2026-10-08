# Track M8 — Release

- **Depends on:** all tracks; D6 (Apple account)
- **Parallel with:** —

## Goal
See `docs/mobile/PLAN.md` §4 for how this track fits.

## Tasks
- TestFlight internal → external; App Store metadata, screenshots, privacy labels.
- Review notes: Clausly provides legal *information*, not legal advice; test account; billing explanation per ADR-0004.
- Version-gate via `/api/client-config`; rollback plan.

## Acceptance
Build accepted by TestFlight; submission checklist complete; owner signs off.

## Ground rules
Read `docs/mobile/PLAN.md` §5 first. Branch: `claude/mobile-release`. One PR, human-reviewed;
never merge. Never weaken RLS, never ship a service-role key to a client, mutations go
through existing API routes, keep legal-information disclaimers, update
`docs/QUALITY_LOG.md` for behavior changes. If you hit an undecided question, add it to
`docs/mobile/PLAN.md` §3 instead of guessing.
