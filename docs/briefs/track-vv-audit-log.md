# Track VV — Audit log

## Goal

Every significant action a user takes is recorded in an `audit_events`
table. Pro users can view their own log in Settings → Activity. This
is the foundation for future security features (suspicious activity
detection, B2B compliance answers, "who changed this?" debugging).

## Non-goals

- Not admin-side viewing (no internal staff dashboard).
- Not real-time tail / streaming.
- Not exporting the log (Track RR can add this later).
- Not capturing read events (only writes / state changes).

## Architecture

| File | Purpose |
|---|---|
| `supabase/migrations/20260622000100_audit_events.sql` | `audit_events` table + RLS |
| `src/lib/audit/log.ts` | `logAuditEvent(supabase, {userId, action, resourceType, resourceId, metadata?})` |
| `src/lib/audit/actions.ts` | Enum of allowed `action` strings (typed constants) |
| `src/app/api/audit/route.ts` | `GET ?cursor=&limit=` paginated user-scoped read |
| `src/app/dashboard/settings/activity/page.tsx` | Activity log UI (Pro-gated) |
| Multiple call sites | Insert `logAuditEvent` calls at write surfaces |

## Database

```sql
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_events enable row level security;
create policy "owners read own audit" on public.audit_events
  for select using (user_id = (select auth.uid()));
grant select on public.audit_events to authenticated;
create index audit_events_user_created_idx
  on public.audit_events (user_id, created_at desc);
create index audit_events_action_idx on public.audit_events (action);
```

## Action vocabulary (in `actions.ts`)

```ts
export const AUDIT_ACTIONS = {
  DOCUMENT_UPLOADED: "document.uploaded",
  DOCUMENT_DELETED: "document.deleted",
  REMINDER_APPROVED: "reminder.approved",
  REMINDER_DISMISSED: "reminder.dismissed",
  REMINDER_FIRED: "reminder.fired",
  CONVERSATION_CREATED: "conversation.created",
  SUBSCRIPTION_UPGRADED: "subscription.upgraded",
  SUBSCRIPTION_CANCELLED: "subscription.cancelled",
  SHARE_CREATED: "share.created",
  SHARE_REVOKED: "share.revoked",
  EXPORT_CREATED: "export.created",
  ACCOUNT_DELETED: "account.deleted",
} as const;
```

If Track SS / RR have NOT shipped, omit the share/export ones — do not
fail the build over missing call sites.

## Commit cadence (CRITICAL)

**Commit + push after EACH numbered deliverable.**

## Deliverables

### 1. Migration + helper + action constants
- Write migration (do NOT apply)
- Update `src/lib/supabase/types.ts`
- `src/lib/audit/actions.ts` with `AUDIT_ACTIONS` constants
- `src/lib/audit/log.ts`:
  - `logAuditEvent(supabase, params)` — best-effort insert, swallows
    errors with `console.warn` (NEVER throws — audit logging must not
    break user actions)
  - Truncates metadata JSON to <2KB before insert
  - Strips sensitive keys: `password`, `token`, `secret`, `key`
- Tests: 6 minimum (insert happy, error doesn't throw, metadata truncate,
  sensitive key strip, action enum exhaustiveness, mock mode)
- Commit: `feat(db): add audit_events table + log helper`

### 2. Wire call sites
- `POST /api/documents/upload` (or existing upload route) → `DOCUMENT_UPLOADED`
- `DELETE /api/documents/[id]` → `DOCUMENT_DELETED`
- `PATCH /api/reminders/[id]` when status changes to approved → `REMINDER_APPROVED`
- Reminder dispatch loop when sent → `REMINDER_FIRED`
- `POST /api/conversations` (or conversation creation in Ask routes) → `CONVERSATION_CREATED`
- Stripe webhook on `checkout.session.completed` → `SUBSCRIPTION_UPGRADED`
- Stripe webhook on `customer.subscription.deleted` → `SUBSCRIPTION_CANCELLED`
- Account delete flow → `ACCOUNT_DELETED`
- Don't add new tests for each call site — the helper test covers it.
- Add 1 integration test verifying upload+delete produces 2 audit rows.
- Commit: `feat(audit): emit audit events from write surfaces`

### 3. API route + UI page
- `GET /api/audit?cursor=&limit=`:
  - Returns `{events, nextCursor}` paginated by `created_at desc`
  - Default limit 50, max 100
  - Auth: 401 unauth
  - **Pro-gate**: free users get 403 with upgrade message
- `src/app/dashboard/settings/activity/page.tsx`:
  - Server page, fetches first 50 events
  - Renders timeline-style list: icon + action label + resource link +
    relative time ("2 hours ago")
  - Action labels via i18n-style map (e.g. `"document.uploaded" → "Uploaded a document"`)
  - Infinite scroll using cursor
  - Filter chips by resource type (Documents / Reminders / Account / Billing)
  - Empty state: "No activity yet."
  - Free users: upgrade card instead of timeline
- Add "Activity log" link to settings sidebar nav
- Tests: 5 minimum (route 4xx + happy, page render, filter, free-user gate)
- Commit: `feat(audit): add /api/audit + Activity settings page`

## Tests required

- Helper: 6
- Integration: 1
- Route + UI: 5
- Total: ~12 new tests

## Definition of done

- `npm test` ✅ all passing
- `npm run lint` ✅ clean
- `npx tsc --noEmit` ✅ clean
- `npx next build` ✅ clean
- Migration written but NOT applied
- All 3 commits pushed to `track-vv-audit-log`
- PR body QA hook (as Pro user):
  1. Upload a document → Settings → Activity → see "Uploaded a document" event
  2. Delete that document → see "Deleted a document" event below
  3. Filter "Billing" → only Stripe events visible
  4. As free user: Activity page shows upgrade card
- No regressions on write surfaces (uploads still work, reminders still
  approve, Stripe still upgrades — audit logging is fire-and-forget)

## Failure mode

The audit logger MUST NOT block or fail any user action. Wrap the call
in try/catch + console.warn. If the DB insert errors, the action still
succeeds. Tests must cover this explicitly.
