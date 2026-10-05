# iOS Progress Tracker

The daily routine ([`ROUTINE.md`](ROUTINE.md)) reads this file, does **exactly one**
step per run, and updates it. Humans may edit it too (reorder, add, mark owner steps done).

**Status values:** `todo` · `in-review` (PR open) · `merged` · `blocked-owner` (needs the owner, see *Owner actions*) · `blocked-decision` (needs an answer on the PLAN §3 board) · `done-owner`
**Dependency rule:** a step is eligible only when every step in *Needs* is `merged` / `done-owner`. If nothing is eligible, the run does the web review only and emails "waiting on <PR/owner>".
**Limit:** at most 2 mobile PRs open at once.

## Current focus
Phase A — repo foundation and the shared contract (backend/web-safe, no UI risk).

## Steps

### Phase A — Foundation
| ID | Step | Needs | Who | Status |
|---|---|---|---|---|
| S00 | Plan, ADRs, track briefs | — | agent | merged (#98) |
| S01 | Bearer-token auth on server Supabase client (ADR-0003) | S00 | agent | in-review (#99) |
| S02 | Repo organization: CLAUDE.md, README, docs index, config excludes for `mobile/`, PR template, CODEOWNERS, this tracker + routine | S00 | agent | in-review (see PR) |
| S03 | `packages/shared` scaffold + npm workspaces (web stays at repo root); CI builds/tests it; web output unchanged | S02 | agent | todo |
| S04 | Move zod schemas + DB types into `packages/shared`; web imports them | S03 | agent | todo |
| S05 | Typed API client in shared (auth injection, error shape); `X-Clausly-Client` header; `GET /api/client-config` (`minSupportedVersion`) with tests | S04, S01 | agent | todo |
| S06 | Web Playwright smoke for the core journey (sign in → upload → analysis → approve reminder → sign out) as the parity oracle | S02 | agent + owner (test account/env) | blocked-owner |

### Phase B — App skeleton
| ID | Step | Needs | Who | Status |
|---|---|---|---|---|
| S07 | Expo + TypeScript scaffold in `mobile/`; jest-expo; lint; separate CI job (web job untouched) | S05 | agent | todo |
| S08 | Design tokens mapped from web + navigation shell (tabs: Documents, Reminders, Settings) | S07 | agent | todo |
| S09 | Email/password sign-in with Supabase; tokens in secure storage; session restore; sign-out | S08, S01 | agent | todo |
| S10 | Sign in with Apple + Google (PKCE deep link) | S09 | agent + owner (Apple/Google config) | blocked-owner |

### Phase C — Core journey
| ID | Step | Needs | Who | Status |
|---|---|---|---|---|
| S11 | Documents list (RLS read, persisted read cache, empty/error/loading states) | S09 | agent | todo |
| S12 | Document detail: summary, clauses, dates, risk, source references, failed-analysis state | S11 | agent | todo |
| S13 | Upload via document picker (25 MB cap, progress, errors) calling `/api/upload` | S11, S05 | agent | todo |
| S14 | Processing status via Realtime on `documents.status` | S13 | agent | todo |
| S15 | Reminders: list, review/edit, approve/reject (409 `REMINDER_PAST` handled like web) | S12 | agent | todo |
| S16 | Settings: profile, notification prefs, in-app account deletion, legal-information disclaimer | S09 | agent | todo |
| S17 | Share-sheet "Open in Clausly" (needs a dev build) | S13 | agent + owner | todo |

### Phase D — Notifications, billing, hardening
| ID | Step | Needs | Who | Status |
|---|---|---|---|---|
| S18 | `device_tokens` migration + RLS + register/unregister endpoints | S09 | agent (flag migration to owner) | todo |
| S19 | Push dispatcher for due reminders; decide cron cadence so `reminder_time` is honored (flag Vercel plan impact) | S18 | agent + owner (decision) | blocked-decision |
| S20 | Client push registration + local notifications | S18, S10 | agent | todo |
| S21 | Billing per ADR-0004 (default: free-tier-only first build; Pro entitlement read from `users.subscription_tier`) | S15, D4 | agent + owner (D4) | blocked-decision |
| S22 | Parity checklist `docs/mobile/PARITY.md` + accessibility pass (Dynamic Type, VoiceOver labels) | S16, S15 | agent | todo |
| S23 | Security review with a live test user: RLS cross-user checks on every table the app reads, bundle has no secrets, token storage, privacy manifest (`docs/mobile/SECURITY_REVIEW.md`) | S22 | agent + owner (test user) | todo |

### Phase E — Release (owner-heavy)
| ID | Step | Needs | Who | Status |
|---|---|---|---|---|
| S24 | EAS build config + `app.json` (bundle id, icons, privacy strings) | S23 | agent + owner (Apple/Expo accounts) | blocked-owner |
| S25 | TestFlight internal build; owner installs and tests | S24 | owner | blocked-owner |
| S26 | App Store metadata, screenshots, privacy labels, review notes (legal-information disclaimer, test account) | S25 | agent drafts, owner submits | todo |

## Owner actions (the routine emails when one of these is the next blocker)
1. Merge open PRs (the routine never merges).
2. Apple Developer Program enrollment; choose bundle id (e.g. `app.clausly.ios`) — D6.
3. Expo account + `EXPO_TOKEN` (for EAS builds); Apple Sign-In and Google iOS OAuth configuration.
4. A staging test user/environment for Playwright and the live RLS check (never use production user data).
5. Decide D4 (billing) and the reminder cron cadence (S19).

## Deferred web items (pick up when the daily review finds nothing more urgent)
- Reminder "Time" field has no effect on delivery (daily cron) — overlaps S19.
- Free-plan document cap has a check-then-act race (needs a DB-level fix).
- Stripe webhook lacks `past_due` / `invoice.payment_failed` handling (product decision).
- No Playwright/E2E harness on web — S06.

## Run log (newest last; the routine appends one line per run)
- 2026-10-05 — Plan merged (S00); bearer auth in review (S01); repo organization in review (S02).
