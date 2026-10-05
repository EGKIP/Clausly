# ADR 0002 — Mobile client technology (Expo / React Native)

- **Status:** Proposed
- **Date:** 2026-10-05
- **Deciders:** Emmanuel Kiprotich (pending)

## Context
Clausly's backend is Supabase + Next.js API routes. The web UI is React/TypeScript
with zod schemas and generated DB types. We want iOS first, Android cheaply, and
a client that cannot drift from the web contract. See `docs/mobile/PLAN.md`.

## Options
| | Expo / React Native | SwiftUI (native) | Capacitor (wrap web) |
|---|---|---|---|
| Share schemas/types/API client with web | Yes (TypeScript) | No (re-model in Swift) | Yes |
| Android | Same codebase | Separate app | Same codebase |
| Native feel (PDF, share sheet, push) | Good | Best | Weakest |
| App Store review risk | Low | Low | Higher (Guideline 4.2) |
| Team fit (TS/React already) | High | Low | High |

## Decision (proposed)
Expo (React Native + TypeScript), iOS first, with a shared `packages/shared`
workspace for contracts. Native UI; share logic, not DOM components.

## Consequences
- One language across web/mobile; contract tests run in one CI.
- Some native modules (PDF viewing, Keychain, push) rely on the Expo ecosystem.
- Android becomes a small delta after iOS ships.

## Reversal cost
Low before M3 (only scaffolding exists); high after screens ship.
