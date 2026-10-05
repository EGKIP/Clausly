# Clausly — guide for AI agents and contributors

Clausly is a contract intelligence and reminder app: upload a contract → analyze
it → summary, clauses, risk, dates → user-approved reminders. It provides legal
**information**, not legal advice; existing disclaimers must stay intact.

## Repo map

| Path | What it is |
|---|---|
| `src/` | Web app (Next.js 15, React 19, TypeScript). **This is production.** |
| `src/app/api/` | API routes. They hold the business rules (plan caps, quotas, reminder date guard). |
| `src/lib/supabase/` | Supabase clients. `server.ts` accepts cookie **or** `Authorization: Bearer` auth. |
| `supabase/migrations/` | The one DB migration history for every client. |
| `tests/` + `src/**/__tests__` | Vitest unit tests (jsdom). |
| `packages/shared/` | *(planned, S03)* schemas/types/API client shared by web and mobile. |
| `mobile/` | *(planned, S07)* Expo / React Native iOS app. Has its own toolchain; excluded from web tsc/lint/vitest. |
| `docs/` | `adr/` decisions, `briefs/` feature tracks, `mobile/` iOS plan, `QUALITY_LOG.md`. |

## Commands (all must pass before a PR)

```
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
```
CI (`.github/workflows/ci.yml`, check name **"Lint, typecheck, and test"**) runs the first four. Keep that check name — do not rename it.

## Production safety rules

1. `main` is production (Vercel deploys it). Never push to `main`; work on a branch and open a PR.
2. Never disable or weaken RLS. Never put the service-role key in client code or logs.
3. Mutations go through the API routes, not direct table writes from clients.
4. Never commit `.env*` files or credentials. Never print secrets.
5. Schema changes are new files in `supabase/migrations/`; never edit an applied migration.
6. Don't touch `vercel.json`, `.github/workflows/`, or `supabase/migrations/` without saying so in the PR description — these affect production.
7. Keep changes small and tested; fix a bug with a regression test.

## Conventions

- Match the surrounding code's style, naming, and comment density.
- Branches: `claude/<topic>`. PRs against `main`, concise: what was wrong, what changed, how verified, remaining concerns.
- Behavior changes get an entry in `docs/QUALITY_LOG.md` (append only; never rewrite old entries).
- Decisions that are hard to reverse get an ADR in `docs/adr/`.

## iOS / mobile

The iOS plan, decision board, and step-by-step progress live in `docs/mobile/`
(`PLAN.md`, `PROGRESS.md`, `ROUTINE.md`). Work follows `PROGRESS.md` one step at a
time. Web stability comes first: a known P0/P1 web bug blocks the next mobile step.
