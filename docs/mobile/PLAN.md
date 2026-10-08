# Clausly Mobile — Plan & Decision Board

- **Status:** Approved 2026-10-05 — iOS first. D1 (Expo), D2 (iOS first), D3 (bearer auth) accepted; D4 (billing) defaults to free-tier-only first build until decided.
- **Goal:** An iOS app (Android as a near-free follow-on) that is a first-class
  client of the *same* Supabase + Next.js backend as the web app, so documents,
  analysis, reminders, and settings are one shared source of truth.

## 0. Readiness note (honest)

The standing criterion was "7 consecutive quality runs with no unresolved P0/P1".
The log does not clearly show that: a P1 (hardcoded Dates-tab countdowns) was
found as recently as 2026-09-28 and there is no E2E harness. The owner has
chosen to start anyway. This plan therefore **front-loads the backend/contract
work that is safe regardless** (M0–M2) and gates *app screens* (M3+) on a short
stability checkpoint (§6). Nothing here changes web behavior.

## 1. What the codebase tells us (facts, not guesses)

| Finding | Consequence for mobile |
|---|---|
| All 38 route-handler call sites use `createClient()` from `src/lib/supabase/server.ts`, which authenticates from **browser cookies** only. | A native app can't call the API today. Need bearer-token auth (ADR-0003). **This is the single biggest blocker.** |
| Business rules live in the Next routes, not the DB: upload cap/plan (`/api/upload`), Ask quota, export limits, reminder approval (past-date guard), analysis pipeline via `after()` (maxDuration 300s). | The app must call these routes for mutations. Do **not** re-implement them client-side or write to tables directly. |
| Reads are plain tables under RLS (`documents`, `reminders`, `document_dates`, …). | Safe for the app to read directly with supabase-js (RLS enforces ownership) and to use Realtime for processing status. |
| Reminders are delivered by **email** via a **once-daily** cron (`vercel.json`); `reminder_time` is stored but ignored. | Native push is the natural fix and the best mobile value-add. Needs a `device_tokens` table + a more frequent dispatcher. |
| Billing is Stripe Checkout/Portal. | Apple requires In-App Purchase for in-app digital subscriptions (ADR-0004 — owner decision). |
| Google OAuth exists. | App Store 4.8 → must also offer Sign in with Apple. |
| Account deletion exists in-app (Settings). | Satisfies Apple 5.1.1(v). Keep it in the app. |
| Zod schemas in `src/lib/validation`, DB types in `src/lib/supabase/types.ts`. | Move/mirror into a shared package so both clients use one contract. |

## 2. Recommended architecture

```
Clausly/
  src/ …                 (web, unchanged at repo root — Vercel config untouched)
  packages/shared/       zod schemas, Database types, API client, date/risk helpers
  mobile/                Expo (React Native + TypeScript) app, iOS first
  supabase/migrations/   one migration history for both clients
```

- **One backend.** Supabase (Auth, Postgres+RLS, Storage, Realtime) + Next API routes. No second backend.
- **Sync model.** Server is the source of truth. Mobile: lists/detail via supabase-js (RLS) + TanStack Query cache persisted to disk (offline *read*); all mutations via the existing API routes (online-only in v1). Processing progress via Realtime on `documents.status`.
- **Shared package, not shared UI.** Share logic/contracts (schemas, types, API client, formatting, risk/date math). UI is native; do not try to share React DOM components.
- **Workspaces without moving web.** npm workspaces `["packages/*","mobile"]` while web stays at repo root (moving web to `apps/web` would disturb Vercel and every import path for little gain now).
- **Contract safety.** Mobile sends `X-Clausly-Client: ios/<ver>`; add `GET /api/client-config` returning `minSupportedVersion` for forced upgrades; contract tests in `packages/shared` run in CI against route handlers.

## 3. Decision board (owner decides; recommendation given)

| # | Decision | Options | Recommendation | Blocks |
|---|---|---|---|---|
| D1 | Client technology | A) Expo/React Native · B) SwiftUI native (iOS only) · C) Capacitor wrapper of web | **A.** One TS codebase, shares `packages/shared`, iOS+Android, OTA JS updates. B feels best on iOS but no code sharing and Android would be a second app. C is fastest but risks App Store 4.2 ("repackaged website") rejection and poor PDF/upload UX. See ADR-0002 | M3 |
| D2 | Platforms | iOS only · iOS+Android | **iOS first**, Android after M5 (Expo makes it a small delta) | M3 scope |
| D3 | Mobile auth to API | Bearer tokens (Supabase JWT) · separate mobile API | **Bearer on existing routes** (ADR-0003) | M1 |
| D4 | Billing on iOS | A) RevenueCat/StoreKit IAP · B) Free-tier-only app, upgrade on web · C) External link (check current Apple US rules) | **Needs your call + a quick legal/App Store review.** Leaning A for Pro; B is the cheapest v1 (ADR-0004) | M5 |
| D5 | Push notifications | Expo Push (APNs) · direct APNs | **Expo Push** to start; fix cron cadence so `reminder_time` is honored | M4 |
| D6 | Apple Developer account / bundle id / team | — | **Owner action:** enroll ($99/yr), pick bundle id e.g. `app.clausly.ios` | M3 ship |
| D7 | Offline scope v1 | none · read cache · full offline writes | **Read cache only** | M3 |
| D8 | Document capture | file picker only · + camera scan | **File picker + Share-sheet "Open in Clausly"** v1; camera scan later | M3/M6 |

Decisions D1, D3, D4 are the ones that change the plan if answered differently; the rest are low-regret.

## 4. Milestones & agent assignments

Agents are scoped Claude Code sessions, each owning one track with its own
branch (`claude/mobile-<track>`) and brief in `docs/mobile/briefs/`. Tracks
marked ∥ can run in parallel. **Every PR is human-reviewed; agents never merge.**

| Track | Agent role | Deliverable | Depends on | Parallel |
|---|---|---|---|---|
| **M0** | Architect | Accept/adjust ADR-0002..0004; scaffold `packages/shared` + workspaces; CI runs shared tests; no behavior change | D1 | — |
| **M1** | Backend/API | **Done in PR (see below):** `createClient()` accepts cookie **or** bearer, so all routes work unchanged; unit tests. **Remaining:** live end-to-end RLS check with a real test user (M7) | D3 | ∥ M2 |
| **M2** | Shared-contract | Move/mirror zod schemas + DB types into `packages/shared`; typed API client; `X-Clausly-Client` + `/api/client-config` | M0 | ∥ M1 |
| **M3** | Mobile app | Expo scaffold; auth (email + Apple + Google, PKCE deep link); Documents list/detail; upload (picker + share sheet); processing status via Realtime; summary/clauses/dates/risk; reminders review/edit/approve | M1, M2, D1 | — |
| **M4** | Notifications | `device_tokens` migration + RLS; register/unregister; push dispatcher; honor `reminder_time` (cron cadence decision) | M3 auth | ∥ M5 |
| **M5** | Billing | Per D4 (IAP via RevenueCat + webhook → `users.subscription_tier`, or free-tier-only) | D4, M3 | ∥ M4 |
| **M6** | QA | Mobile test harness (Jest + Maestro/Detox smoke); contract tests; a11y (Dynamic Type, VoiceOver); mobile-vs-web parity checklist | M3 | ∥ |
| **M7** | Security | Token storage (Keychain), RLS verification w/ mobile JWT, no service-role in app, ATS, privacy manifest, data-deletion path | M1, M3 | ∥ |
| **M8** | Release | TestFlight, App Store metadata, privacy labels, review notes (legal-information disclaimer retained), screenshots | all | — |

Suggested order: **M0 → (M1 ∥ M2) → M3 → (M4 ∥ M5 ∥ M6 ∥ M7) → M8.**
Realistic shape: M0–M2 are backend/contract work (days, low risk, benefits web
too); M3 is the bulk; M4–M7 overlap; M8 is gated on Apple account + D4.

## 5. Ground rules for every mobile agent

1. Never weaken RLS or put a service-role key in the app. Mobile uses the anon key + user JWT only.
2. Mutations go through the existing API routes (they hold quota/plan/past-date rules). Direct table reads only.
3. Keep legal-information disclaimers intact. Clausly is not a law firm.
4. No new product features beyond web parity until M8 ships.
5. Small PRs, one track per branch, tests with every fix, `docs/QUALITY_LOG.md` updated on behavior changes.
6. If a task needs a decision not on the board, stop and add it to §3 instead of guessing.

## 6. Stability checkpoint before M3 screens

Start M3 once: (a) M1 merged and bearer auth proven by tests; (b) core web flows
(upload → analyze → review → approve reminder) pass for 5 consecutive daily runs
with no new P0/P1; (c) a minimal Playwright smoke exists for that flow (web has
none today — suggested as a small M6-prep task so mobile has a parity oracle).

## 7. Risks

| Risk | Mitigation |
|---|---|
| Bearer auth refactor touches 38 routes | Single helper, mechanical migration, tests per route group; M1 is its own PR set |
| Apple rejects over billing/IAP | Decide D4 early; ship free-tier-first if undecided |
| Long analysis (up to 300s) vs mobile backgrounding | Upload returns fast; analysis runs server-side (`after()`); app shows status via Realtime and push on completion — never holds a request open |
| Web/mobile drift | `packages/shared` as the only contract source + contract tests in CI |
| Large PDFs on cellular | Upload cap already 25 MB; show progress, resumable retry in M6 |
| Reminder timing (daily cron) | M4 decision on cadence; push + local notifications |

## 8. What I need from you

1. Confirm or change D1 (Expo), D2 (iOS first), D3 (bearer), D4 (billing approach).
2. Apple Developer enrollment + bundle id (D6) — only needed by M8, but start early.
3. Approve M0–M2 to start (backend-only, zero UI risk).
