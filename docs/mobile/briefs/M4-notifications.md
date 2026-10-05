# Track M4 — Push notifications

- **Depends on:** M3 auth
- **Parallel with:** ∥ M5

## Goal
See `docs/mobile/PLAN.md` §4 for how this track fits.

## Tasks
- Migration: `device_tokens` (user_id, token, platform, created_at) with RLS (owner only).
- Register/unregister endpoints; respect existing notification preferences.
- Dispatcher sends push for due reminders and analysis-complete; **decide and implement** cron cadence so `reminder_time` is honored (flag Vercel plan impact to the owner before changing `vercel.json`).

## Acceptance
Push received on device for an approved reminder at its chosen time; opt-out honored; tokens never readable by other users.

## Ground rules
Read `docs/mobile/PLAN.md` §5 first. Branch: `claude/mobile-notifications`. One PR, human-reviewed;
never merge. Never weaken RLS, never ship a service-role key to a client, mutations go
through existing API routes, keep legal-information disclaimers, update
`docs/QUALITY_LOG.md` for behavior changes. If you hit an undecided question, add it to
`docs/mobile/PLAN.md` §3 instead of guessing.
