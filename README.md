# Clausly

Understand, organize, and track contracts, leases, and agreements in one place.
Upload a PDF, get a summary, key clauses, risk notes, and important dates, then
approve the reminders you want. Clausly provides legal information, not legal advice.

## Stack
Next.js 15 · React 19 · TypeScript · Supabase (Auth, Postgres + RLS, Storage) · Stripe · Vercel.
iOS app (Expo / React Native) is in planning — see [`docs/mobile/PLAN.md`](docs/mobile/PLAN.md).

## Develop
```
cp .env.local.example .env.local   # fill in your own keys; never commit it
npm ci
npm run dev
```
Checks: `npm run lint` · `npx tsc --noEmit` · `npm test` · `npm run build`.

## Where things are
See [`CLAUDE.md`](CLAUDE.md) for the repo map and rules, and [`docs/README.md`](docs/README.md) for the docs index.
