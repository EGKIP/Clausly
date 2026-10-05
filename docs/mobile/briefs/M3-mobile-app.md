# Track M3 — Mobile app (iOS first)

- **Depends on:** M1, M2, D1 answered, plan §6 checkpoint
- **Parallel with:** —

## Goal
See `docs/mobile/PLAN.md` §4 for how this track fits.

## Tasks
- Expo + TypeScript scaffold in `mobile/`; navigation; design tokens mapped from web (colors/typography) — same visual language, native components.
- Auth: email/password, Sign in with Apple, Google; PKCE deep-link; tokens in Keychain via secure store; session refresh.
- Documents list/detail; upload via picker and share sheet (25 MB cap, progress, error states); processing status via Realtime; summary, clauses, dates, risk, source references, failed-analysis state.
- Reminders: suggested → edit → approve/reject; invalid-date handling matches web (409 `REMINDER_PAST`).
- Settings incl. in-app account deletion; legal-information disclaimer visible.
- Read cache persisted for offline viewing; mutations online-only with clear messaging.

## Acceptance
Parity checklist (docs/mobile/PARITY.md, create it) passes against web for the core journey; runs on a real device via TestFlight-internal build or simulator; VoiceOver and Dynamic Type sane.

## Ground rules
Read `docs/mobile/PLAN.md` §5 first. Branch: `claude/mobile-mobile-app`. One PR, human-reviewed;
never merge. Never weaken RLS, never ship a service-role key to a client, mutations go
through existing API routes, keep legal-information disclaimers, update
`docs/QUALITY_LOG.md` for behavior changes. If you hit an undecided question, add it to
`docs/mobile/PLAN.md` §3 instead of guessing.
