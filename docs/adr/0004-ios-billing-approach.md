# ADR 0004 — iOS billing approach

- **Status:** Proposed — **needs owner decision** and a check of current App Store rules
- **Date:** 2026-10-05
- **Deciders:** Emmanuel Kiprotich (pending)

## Context
Pro is sold via Stripe Checkout/Portal on web. Apple generally requires In-App
Purchase for digital subscriptions sold inside an iOS app (Guideline 3.1.1).
External-purchase rules have changed recently and vary by region, so they must
be re-verified before relying on them.

## Options
- **A. In-App Purchase via RevenueCat/StoreKit.** Webhook updates
  `users.subscription_tier`, so web and iOS share one entitlement. Apple takes its cut.
- **B. Free-tier-only iOS v1; upgrade on web.** Fastest and lowest review risk;
  Pro users can sign in and use Pro on iOS if they upgraded on web (verify this is
  acceptable under current guidelines before shipping).
- **C. External purchase link.** Only if current rules permit for the target storefronts.

## Decision (proposed)
Defer. Default to **B for the first TestFlight/App Store build** while the owner
decides on A. The entitlement source of truth stays `users.subscription_tier`
regardless of option.

## Reversal cost
Medium: switching to A later is additive (new webhook), not a rewrite.
