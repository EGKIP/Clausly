# Track M5 — Billing on iOS

- **Depends on:** D4 answered, M3
- **Parallel with:** ∥ M4

## Goal
See `docs/mobile/PLAN.md` §4 for how this track fits.

## Tasks
- Implement per ADR-0004 (default: free-tier-only first build; Pro entitlement read from `users.subscription_tier`).
- If IAP: RevenueCat/StoreKit, server webhook → `subscription_tier`, restore-purchases, no double-billing with Stripe (same user on both).

## Acceptance
Entitlement matches across web and iOS for the same account; documented App Review notes for billing.

## Ground rules
Read `docs/mobile/PLAN.md` §5 first. Branch: `claude/mobile-billing`. One PR, human-reviewed;
never merge. Never weaken RLS, never ship a service-role key to a client, mutations go
through existing API routes, keep legal-information disclaimers, update
`docs/QUALITY_LOG.md` for behavior changes. If you hit an undecided question, add it to
`docs/mobile/PLAN.md` §3 instead of guessing.
