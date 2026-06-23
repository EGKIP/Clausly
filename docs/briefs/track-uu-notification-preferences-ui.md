# Track UU — Notification preferences UI

## Goal

Settings page gets a new section: **Email notifications**. Users can
toggle reminder emails (existing) and weekly digest emails (Track QQ).
The weekly digest toggle is Pro-gated; free users see it disabled with
an upgrade link.

## Non-goals

- Not adding new notification *channels* (SMS, push). Email only.
- Not configurable digest cadence (always weekly).
- Not per-document notification settings.
- Not in-app notifications.

## Context

`users.notification_preferences` is a JSONB column already used by:
- Reminder dispatch loop reads `email !== false`
- Weekly digest loop (Track QQ) reads `weekly_digest !== false` AND `email !== false`

So the data layer is done. This track is **pure UI + an update route**.

## Architecture

| File | Purpose |
|---|---|
| `src/app/api/settings/notifications/route.ts` | `GET` returns current prefs, `PATCH` updates |
| `src/lib/db/notification-preferences.ts` | `getPreferences`, `updatePreferences` helpers |
| `src/components/dashboard/settings/notification-preferences.tsx` | Form section with toggles |
| `src/app/dashboard/settings/page.tsx` | Mount the new section between existing sections |

## Commit cadence (CRITICAL)

**Commit + push after EACH numbered deliverable.**

## Deliverables

### 1. DB helpers + API route
- `src/lib/db/notification-preferences.ts`:
  - `getPreferences(supabase, userId)` returns
    `{email: boolean, reminders: boolean, weeklyDigest: boolean}`
    with defaults `{email: true, reminders: true, weeklyDigest: true}`
  - `updatePreferences(supabase, userId, patch)` merges into JSONB column
  - Validates: rejects keys other than `email`, `reminders`, `weekly_digest`
- `src/app/api/settings/notifications/route.ts`:
  - `GET` returns current prefs (401 unauth, mock-mode returns defaults)
  - `PATCH` body `{reminders?, weeklyDigest?, email?}` → updates and returns new prefs
  - Pro-gate `weeklyDigest=true` — free users can only set it to `false`
    (they can opt out even though it doesn't apply, but can't opt in
    without upgrading). If a free user PATCHes `weeklyDigest=true`,
    return 403 with `{error, code: "PLAN_REQUIRED"}`.
- Tests: 7 minimum (GET happy, GET mock, PATCH happy, validation,
  reject unknown key, free-user opt-in 403, 401)
- Commit: `feat(api): add /api/settings/notifications route + helpers`

### 2. UI section
- `notification-preferences.tsx` (client component):
  - Fetches initial prefs via `GET /api/settings/notifications`
  - Three toggles:
    - **Reminder emails** — fires when deadlines approach
    - **Weekly digest** — Mondays, portfolio summary (Pro only badge)
    - **All emails** — master switch (when off, others greyed)
  - On toggle: PATCH the route, optimistic update with rollback on error
  - Pro-gate the digest toggle: if `plan === 'free'`, render disabled
    toggle + small "Upgrade to Pro" link → `/dashboard/settings` billing
    section anchor
  - Loading skeleton on initial fetch
- Wire into `src/app/dashboard/settings/page.tsx` between Profile and
  Billing sections (or wherever makes visual sense — match existing
  section spacing)
- Tests: 5 minimum (renders, toggle persists, optimistic rollback on
  error, Pro-gate visible for free, master switch greys others)
- Commit: `feat(settings): add notification preferences section`

## Tests required

- API + helpers: 7
- UI: 5
- Total: ~12 new tests

## Definition of done

- `npm test` ✅ all passing
- `npm run lint` ✅ clean
- `npx tsc --noEmit` ✅ clean
- `npx next build` ✅ clean
- No migration (column already exists)
- All 2 commits pushed to `track-uu-notification-preferences-ui`
- PR body QA hook:
  1. As Pro user: Settings → toggle Weekly digest off → refresh → still off
  2. Toggle Reminder emails off → next reminder dispatch run does not email this user
  3. As free user: Weekly digest toggle is disabled with upgrade link
  4. Toggle master "All emails" off → other toggles grey out
- No regressions on Settings page

## Default behaviour reminder

When `notification_preferences` is null or empty `{}`, all flags default
to true. This is already the contract in the dispatch + digest loops.
Don't change that — the UI just reflects it.
