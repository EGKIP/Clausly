# Track SS — Shareable read-only contract digest

## Goal

Pro users can create a tokenised public link to share a contract digest
with a counterparty (e.g. landlord, employer, opposing counsel). The
link renders a read-only view at `/share/[token]` — no auth required,
no source PDF, optional expiry, revocable.

## Non-goals

- Not collaboration (no comments, no editing).
- Not download from share page (separate from Track RR exports).
- Not free-tier (Pro only).
- Not password-protected (token = capability, may revisit later).
- Not analytics on views (future track).

## Architecture

| File | Purpose |
|---|---|
| `supabase/migrations/20260621000100_document_shares.sql` | `document_shares` table + RLS |
| `src/lib/db/shares.ts` | `createShare`, `getShareByToken`, `revokeShare`, `listShares` |
| `src/app/api/documents/[id]/shares/route.ts` | `POST` create, `GET` list (owner-only) |
| `src/app/api/documents/[id]/shares/[shareId]/route.ts` | `DELETE` revoke |
| `src/app/api/shares/[token]/route.ts` | `GET` public — returns digest payload |
| `src/app/share/[token]/page.tsx` | Public read-only digest page |
| `src/components/dashboard/share/share-dialog.tsx` | "Share" button → modal with copy-link, expiry select, revoke list |
| `src/components/dashboard/document-view.tsx` | Add Share button to action bar |

## Database

```sql
create table public.document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.document_shares enable row level security;
create policy "owners manage own shares" on public.document_shares
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update on public.document_shares to authenticated;
create index document_shares_token_idx on public.document_shares (token);
create index document_shares_user_created_idx
  on public.document_shares (user_id, created_at desc);
```

## Commit cadence (CRITICAL)

**Commit + push after EACH numbered deliverable.**

## Deliverables

### 1. Migration + DB helpers
- Write migration (do NOT apply)
- `src/lib/db/shares.ts`:
  - `createShare(supabase, {documentId, userId, expiresInDays?})` — generates 32-byte URL-safe token via `crypto.randomBytes`, stores it
  - `getShareByToken(supabase, token)` — uses SERVICE client (bypass RLS for public access); returns null if expired/revoked
  - `revokeShare(supabase, shareId, userId)` — sets revoked_at
  - `listShares(supabase, documentId, userId)` — owner's shares for a doc
  - `incrementViewCount(supabase, shareId)` — best-effort, ignore errors
- Tests: 6 minimum
- Commit: `feat(db): add document_shares table + helpers`

### 2. Owner API routes
- `POST /api/documents/[id]/shares`: body `{expiresInDays?: number}`,
  returns `{id, token, url, expiresAt}`. **Pro-gate** with existing
  `getUserPlan` — free users get 403 with upgrade message.
- `GET /api/documents/[id]/shares`: returns list of active + revoked shares
- `DELETE /api/documents/[id]/shares/[shareId]`: revokes
- Auth: 401 unauth, 404 doc not owned, 403 free user, 200 happy
- Tests: 7 minimum
- Commit: `feat(api): add owner share routes`

### 3. Public share route + page
- `GET /api/shares/[token]`:
  - Uses SERVICE client to bypass RLS (no auth required)
  - Returns 404 if not found, expired, or revoked
  - Returns digest: `{document: {title, type, party, dates}, summary, clauses, recommendedActions}`
  - Increments `view_count`
  - Does NOT include `source_quote` text by default (privacy). Includes
    `plain_english` + `why_it_matters` only.
- `src/app/share/[token]/page.tsx`:
  - Server component, fetches the digest
  - Branded header with Clausly logo + "Read-only digest" badge
  - Layout mirrors document detail but read-only
  - Footer: "This is a shared digest. The full contract is held by the sender. Informational only — not legal advice."
  - 404 page with friendly message if invalid
- Tests: 5 minimum (route 4xx paths, page render)
- Commit: `feat(share): add public share endpoint + page`

### 4. Share dialog UI
- `share-dialog.tsx`:
  - "Create share link" button
  - Expiry select: "Never", "7 days", "30 days", "90 days"
  - On create: shows generated URL + Copy button + QR code (optional, only if `qrcode` package small)
  - List of existing shares with status (active / expired / revoked), created date, view count, Revoke button
  - Pro gate: if free user, show upgrade card instead of dialog body
- Wire button into `document-view.tsx` action bar (next to Compare)
- Tests: 4 minimum
- Commit: `feat(share): add share dialog UI to document detail`

## Tests required

- DB helpers: 6
- Owner API: 7
- Public + page: 5
- UI: 4
- Total: ~22 new tests

## Definition of done

- `npm test` ✅ all passing
- `npm run lint` ✅ clean
- `npx tsc --noEmit` ✅ clean
- `npx next build` ✅ clean
- Migration written but NOT applied
- All 4 commits pushed to `track-ss-shareable-links`
- PR body QA hook:
  1. As Pro user: open document → Share → create link → copy URL
  2. Open URL in incognito window → see digest, no auth wall
  3. Revoke the share → URL now 404s
  4. Create with 7-day expiry → after 7 days link 404s (or simulate via DB)
  5. As free user: Share button shows upgrade card
- No regressions on existing document detail

## Token security

- 32 bytes via `crypto.randomBytes(32).toString("base64url")` = 256 bits entropy
- Stored as plain text in DB — that's fine, capability tokens are designed
  to be in URLs. Do not log them. Do not include them in audit_events
  metadata if Track VV ships later.
