# ADR 0001 — Supabase as v0.2 Backend (over Django + AWS)

- **Status:** Accepted
- **Date:** 2026-06-05
- **Deciders:** Emmanuel Kiprotich
- **Supersedes:** Implementation guidance in PRD §10.2, §10.3, §10.4, §10.7, §10.9 (recommendations remain, are not deleted)

## Context

The PRD (`PRD_Clausly_App.md`, §10) recommends a Django + Django REST
Framework backend on PostgreSQL, with AWS S3 for file storage, Clerk or
AWS Cognito for authentication, and AWS EventBridge / Celery beat for
scheduled jobs. The PRD frames these as *recommended* choices, and §10.7
states explicitly: *"Use the auth provider that allows the team to move
fastest while still maintaining secure user-owned document access."*

At v0.2 we are a small team shipping an MVP with no live users. The
frontend (Next.js 15, see commit `081d044`) is complete and on `main`.
The backend, auth, storage, and AI pipeline are all still to build.

## Decision

For v0.2, Clausly will use **Supabase** as the primary backend platform,
covering:

- **Database** — Supabase-managed PostgreSQL.
- **Authentication** — Supabase Auth (email/password, OAuth, magic link).
- **Storage** — Supabase Storage for original PDFs and extracted text.
- **Authorization** — PostgreSQL Row Level Security (RLS) policies for
  per-user data isolation.
- **Realtime (optional)** — Supabase Realtime for live status updates
  during AI extraction.

**AWS remains the documented scale-up path**, specifically for:

- **S3** — when storage volume, lifecycle rules, or cross-region
  replication outgrow Supabase Storage.
- **Textract** — for OCR on scanned PDFs beyond what direct extraction
  handles.
- **SES** — for transactional email at higher volumes than the chosen
  v0.2 provider (Resend or similar).
- **EventBridge Scheduler** — if `pg_cron` proves insufficient for
  reminder scheduling.
- **Cognito** — only if a future enterprise customer requires it.

Long-running AI extraction jobs (PDF parse + multi-pass LLM analysis,
typically 30–90 seconds) will run on a durable execution platform
(**Inngest** is the current pick) rather than Supabase Edge Functions
or Vercel Functions, both of which have execution-time limits that are
too tight for this workload.

## Consequences

### Accepted gains

- **Faster v0.2** — estimated 3–4 weeks saved versus standing up
  Django + DRF + Postgres + S3 + Clerk + Celery separately.
- **RLS-enforced data isolation** — the PRD's most important security
  invariant (users access only their own documents, §22.2) is enforced
  at the database layer, not in application code. A buggy API route
  cannot leak rows.
- **Single language** — TypeScript end-to-end. No Python/TS context
  switching. Generated types from Supabase mirror the database.
- **Fewer services to operate** — Vercel + Supabase + Inngest, all
  managed. No Django host, no separate Postgres, no IAM setup.
- **Lower MVP cost** — Supabase free tier covers v0.2 scale.
- **Signed URLs for private files** (PRD §13) — built-in and RLS-aware.

### Accepted costs

- **Vendor lock-in is higher.** Postgres data is portable; RLS policies,
  Supabase Auth schema, and Storage paths are not. Migrating off
  Supabase later is estimated at 2–4 weeks of focused work.
- **No Django Admin.** We lose the free admin UI mentioned in PRD §10.2.
  Mitigation: a small internal admin route gated by `is_admin`, built
  only when needed.
- **AI JSON validation moves to Zod** instead of DRF serializers. Fine
  for our needs, possibly better DX, but a different toolchain.
- **Audit logging becomes DIY** (Postgres triggers / Supabase audit
  log). PRD §13 expects audit-friendly logging — this must be an
  explicit early task, not an afterthought.
- **Long-running jobs require a separate platform** (Inngest). One more
  service in the dependency graph.

## Reversal cost

If Clausly outgrows Supabase or an enterprise contract requires Django
or self-hosting:

- **Database** — `pg_dump` / `pg_restore` is straightforward. ~1 week.
- **Auth** — Supabase users can be exported and re-imported into Clerk
  or Cognito; password hashes are bcrypt-compatible. ~3–5 days.
- **Storage** — S3-compatible API; bulk copy via `rclone`. ~2–3 days.
- **RLS policies** — must be re-implemented as application-level
  authorization. ~1–2 weeks depending on policy complexity.

Total estimated reversal: **3–5 weeks** of focused work.

## Status review trigger

This decision should be revisited when **any** of the following occur:

- Clausly crosses 10,000 monthly active users.
- An enterprise prospect requires self-hosting, on-premise deployment,
  or a specific compliance posture (SOC 2 Type II at the infrastructure
  layer, HIPAA, etc.) that Supabase cannot meet.
- Storage exceeds the Supabase plan ceiling we are on.
- Average AI extraction latency exceeds platform limits we cannot work
  around with Inngest.

When triggered, a new ADR supersedes this one. Until then, this ADR is
the authoritative source for backend architecture decisions.
