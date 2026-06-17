# Track QQ — Weekly insights digest email (Pro)

## Goal

Every Monday at 14:00 UTC, Pro users receive an email summarising their
portfolio: deadlines this week, deadlines next 30 days, recent uploads,
and any new high-risk clauses since the last digest. The digest matches
PRD §9.3 and is the primary Pro retention hook.

## Non-goals

- Not configurable cadence (always weekly). Future track.
- Not user-customisable content. Future track.
- Not free-tier. Pro only.
- Not in-app digest UI. Email-only.

## Architecture

| File | Purpose |
|---|---|
| `supabase/migrations/20260619000100_weekly_digest.sql` | `weekly_digest_sent_at timestamptz` on `users`; `weekly_digests` audit table |
| `src/lib/notifications/weekly-digest.ts` | `buildDigestForUser(supabase, userId)` + `sendWeeklyDigests(supabase, options?)` |
| `src/lib/notifications/templates/weekly-digest.tsx` | React Email template (see existing reminder template) |
| `src/app/api/notifications/weekly-digest/route.ts` | Cron-triggered handler, same auth pattern as `/api/notifications/dispatch` |
| `vercel.json` | Add second cron entry: `0 14 * * 1` (Mondays 14:00 UTC) |

## Reuses

- `createServiceSupabaseClient()` for RLS bypass
- `createEmailProvider()` from `src/lib/notifications/email-provider.ts`
- `CLAUSLY_EMAIL_FROM`, `CLAUSLY_UNSUBSCRIBE_SECRET`, `CRON_SECRET`,
  `CLAUSLY_DISPATCH_SECRET`, `BASE_URL` env vars — no new envs needed

## Commit cadence (CRITICAL)

**Commit and push after EACH numbered deliverable.** Each commit must
build + lint + test clean.

## Deliverables

### 1. Migration + types + audit table
- Write `supabase/migrations/20260619000100_weekly_digest.sql` (do NOT apply):
  ```sql
  alter table public.users add column weekly_digest_sent_at timestamptz;

  create table public.weekly_digests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    sent_at timestamptz not null default now(),
    deadline_count integer not null default 0,
    upload_count integer not null default 0,
    high_risk_count integer not null default 0,
    status text not null default 'sent' check (status in ('sent','failed','skipped')),
    error_message text
  );

  alter table public.weekly_digests enable row level security;
  create policy "owners read own digests" on public.weekly_digests for select
    using (user_id = (select auth.uid()));
  grant select on public.weekly_digests to authenticated;

  create index weekly_digests_user_sent_idx
    on public.weekly_digests (user_id, sent_at desc);
  ```
- Update `src/lib/supabase/types.ts`
- Commit: `feat(db): add weekly_digest_sent_at + weekly_digests audit table`

### 2. Digest builder + template
- `src/lib/notifications/weekly-digest.ts`:
  - `buildDigestForUser(supabase, userId, now?)`: returns
    `{ user: {email,name}, deadlinesThisWeek: Reminder[], deadlinesNext30: Reminder[], recentUploads: Document[], newHighRiskClauses: Clause[] }`
  - "This week" = `fire_on between now and now+7d`
  - "Next 30" = `fire_on between now+7d and now+30d`
  - "Recent uploads" = `documents` created in last 7 days
  - "New high-risk" = `clauses` with `risk_level in ('high','needs_review')`
    created since user's `weekly_digest_sent_at` (or last 7d if null)
- React Email template at `src/lib/notifications/templates/weekly-digest.tsx`
  — match the visual language of the existing reminder template
- Tests: builder test with mock supabase covering each section
- Commit: `feat(notifications): add weekly digest builder + email template`

### 3. Send loop + audit
- `sendWeeklyDigests(supabase, opts?)` in same file:
  - Query Pro users where `notification_preferences.weekly_digest != false`
    (default true) AND `subscription_tier = 'pro'`
  - For each: build digest, skip if all 4 sections empty (insert
    `weekly_digests` row with `status='skipped'`), else render + send via
    email provider, insert audit row, update `weekly_digest_sent_at`
  - Return `{processed, sent, skipped, failed}`
- Tests: at least 5 (happy path, all-empty skip, send failure, Pro filter,
  unsubscribe preference)
- Commit: `feat(notifications): add weekly digest send loop + audit`

### 4. Cron route + vercel.json
- `src/app/api/notifications/weekly-digest/route.ts` mirrors
  `/api/notifications/dispatch` — same `CRON_SECRET` / `CLAUSLY_DISPATCH_SECRET`
  bearer check, calls `sendWeeklyDigests()`
- Add to `vercel.json`:
  ```json
  { "path": "/api/notifications/weekly-digest", "schedule": "0 14 * * 1" }
  ```
- Tests: route auth test (401/200), service env missing returns 503
- Commit: `feat(api): add weekly digest cron route + schedule`

## Notification preference

Reuse `users.notification_preferences` JSON. Read `weekly_digest` boolean;
default true if absent. Unsubscribe link in email uses existing HMAC
token format with `type=weekly_digest`. Settings UI changes are
out-of-scope (track for later).

## Tests required

- Builder: 5 tests
- Send loop: 5 tests
- Route: 3 tests
- Template snapshot: 1 test
- Total: ~14 new

## Definition of done

- `npm test` ✅ all passing
- `npm run lint` ✅ clean
- `npx tsc --noEmit` ✅ clean
- `npx next build` ✅ clean
- Migration written but NOT applied
- All 4 commits pushed to `track-qq-weekly-digest`
- PR body QA hook:
  1. As Pro user with 1+ approved reminder due in 7d: trigger route manually
     with `Authorization: Bearer $CLAUSLY_DISPATCH_SECRET`
  2. Receive digest email in inbox
  3. SQL: `select * from weekly_digests order by sent_at desc limit 1` → row present
  4. `users.weekly_digest_sent_at` updated
- vercel.json validated
