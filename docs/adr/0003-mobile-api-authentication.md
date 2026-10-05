# ADR 0003 — Mobile API authentication (bearer tokens on existing routes)

- **Status:** Proposed
- **Date:** 2026-10-05
- **Deciders:** Emmanuel Kiprotich (pending)

## Context
All 38 API route-handler call sites build their Supabase client with
`createClient()` (`src/lib/supabase/server.ts`), which reads the session from
browser cookies. A native app holds a Supabase access token (JWT), not cookies,
so it cannot call these routes today. Business rules (plan caps, Ask quota,
export limits, reminder past-date guard, analysis pipeline) live in these routes.

## Decision (proposed)
Add `getRouteClient(request)` that returns a Supabase client authenticated by
`Authorization: Bearer <access_token>` when present, else by cookies as today.
Migrate all call sites to it. No separate mobile API; no service-role key in
the app; RLS remains the authorization boundary.

## Consequences
- Web behavior unchanged (cookie path identical).
- Bearer requests are not CSRF-exposed; cookie requests keep current protections.
- Tests must cover: cookie auth, bearer auth, no auth (401), and cross-user denial
  for each route group.
- Token refresh is the client's job (supabase-js on mobile).

## Reversal cost
Low: the helper falls back to the existing cookie behavior.
