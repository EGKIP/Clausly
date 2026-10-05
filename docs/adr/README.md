# Architecture Decision Records

This directory captures significant architectural decisions for Clausly.

Each ADR documents:

- **Context** — the situation and constraints at the time of the decision.
- **Decision** — what we chose.
- **Consequences** — the trade-offs we accepted.
- **Status** — Proposed / Accepted / Superseded.
- **Reversal cost** — a rough estimate of what it would take to undo.

ADRs are append-only. If a decision is revisited, write a new ADR that
supersedes the old one and update the old one's status.

## Index

- [0001 — Supabase as v0.2 backend (over Django + AWS)](./0001-supabase-over-django.md)
- [0002 — Mobile client technology (Expo / React Native)](./0002-mobile-client-technology.md) — Proposed
- [0003 — Mobile API authentication (bearer tokens)](./0003-mobile-api-authentication.md) — Proposed
- [0004 — iOS billing approach](./0004-ios-billing-approach.md) — Proposed, needs owner decision
