# Track II — Stripe Pro upgrade flow

**Owner:** Codex
**Branch:** `track-ii-stripe-pro-upgrade`
**Base:** `main` (cut FRESH after HH + briefs-batch-2 merge)
**Estimated effort:** ~1 day
**Pick-up order:** FIRST in batch 2 — most isolated, biggest business value

## Goal

Free users can click "Upgrade to Pro" and pay via Stripe Checkout. On successful
payment, their `users.subscription_tier` automatically flips to `'pro'` via the
Stripe webhook. Pro users can manage their subscription through the Stripe
Customer Portal (cancel, update payment method, see invoices).

Right now `subscription_tier` is a column nobody can change without manual
SQL — this track unblocks real revenue.

## Non-goals (do NOT touch)
- No annual plans, no team plans, no trials, no proration. ONE Pro price, monthly.
- No coupon/discount system.
- No tax handling beyond Stripe's automatic tax (Stripe handles it for us).
- Do NOT change `PLAN_LIMITS`, `getUserPlan`, `canUploadDocument`, or any other plan-checking helper. They keep reading `users.subscription_tier` unchanged.
- No downgrade UI — Stripe Customer Portal handles cancellation; on cancel, webhook downgrades the user.
- No migration to add a `stripe_customer_id` column on `users` — store it in a separate `billing_customers` table to keep `users` clean.

## Architecture

```
UPGRADE FLOW:
1. Free user clicks "Upgrade to Pro" on /dashboard/settings (or insights upgrade card)
2. Client POSTs to /api/billing/checkout
3. Server: getOrCreateStripeCustomer(user) → returns customer_id
4. Server: stripe.checkout.sessions.create({ mode:'subscription', customer, line_items:[{ price: STRIPE_PRO_PRICE_ID, quantity:1 }], success_url, cancel_url, automatic_tax:{enabled:true} })
5. Server returns { url }; client window.location.href = url
6. User pays at checkout.stripe.com
7. Stripe sends checkout.session.completed webhook → /api/billing/webhook
8. Webhook: verify signature, look up customer's user_id, UPDATE users SET subscription_tier='pro'
9. User redirected to /dashboard/settings?upgraded=1 → toast "Welcome to Pro"

MANAGE FLOW:
1. Pro user clicks "Manage subscription"
2. Client POSTs to /api/billing/portal
3. Server: stripe.billingPortal.sessions.create({ customer, return_url })
4. Redirect user to portal URL

CANCEL FLOW (handled by Stripe Portal):
- User cancels via portal
- Stripe sends customer.subscription.deleted webhook
- Webhook: UPDATE users SET subscription_tier='free'
```

## Scope — 7 deliverables

### 1. Migration `supabase/migrations/<timestamp>_billing_customers.sql`
- New table `billing_customers`:
  ```sql
  create table public.billing_customers (
    user_id uuid primary key references public.users(id) on delete cascade,
    stripe_customer_id text not null unique,
    created_at timestamptz not null default now()
  );
  alter table public.billing_customers enable row level security;
  create policy "Users can read their own billing customer row"
    on public.billing_customers for select
    using (user_id = (select auth.uid()));
  -- No insert/update policy — only service_role writes (from webhook + server routes).
  ```
- Augment will apply this manually via Supabase MCP after PR review. Write the file, do NOT try to apply.

### 2. `src/lib/billing/stripe.ts` (new file)
- `getStripe(): Stripe` — lazy-init singleton from `STRIPE_SECRET_KEY`. Throws clear error if missing.
- `getOrCreateStripeCustomer(supabase, user): Promise<string>` — checks `billing_customers`, creates Stripe customer if missing, persists row, returns id.
- Use `stripe` npm package (add via `npm install stripe`).

### 3. `POST /api/billing/checkout` (new route)
- Auth required (401 if no session).
- `if (await getUserPlan(supabase, user.id) === 'pro') return 409 { error: 'Already on Pro.' }`.
- Calls `getOrCreateStripeCustomer`, then `stripe.checkout.sessions.create(...)`.
- Returns `{ url: session.url }`.
- Demo mode (`!hasSupabaseEnv()`): return `{ url: '/dashboard/settings?demo=true' }` and don't call Stripe.

### 4. `POST /api/billing/portal` (new route)
- Auth required.
- Look up `stripe_customer_id` from `billing_customers`. If missing → 404 "No subscription found."
- `stripe.billingPortal.sessions.create({ customer, return_url: BASE_URL + '/dashboard/settings' })`.
- Returns `{ url }`.

### 5. `POST /api/billing/webhook` (new route, public — no auth)
- Read raw body for signature verification: `await request.text()` then `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`.
- Handle two event types ONLY:
  - `checkout.session.completed`: look up `billing_customers` by `stripe_customer_id`, then UPDATE `users SET subscription_tier='pro' WHERE id=<user_id>`.
  - `customer.subscription.deleted`: UPDATE `users SET subscription_tier='free' WHERE id=<user_id>`.
- Use the service_role Supabase client (server-side, not request-scoped) to bypass RLS.
- Always return `{ received: true }` after handling (or already-processed). Return 400 on signature failure.

### 6. UI updates
- `src/app/dashboard/settings/page.tsx`:
  - If plan is 'free': show "Upgrade to Pro — $X/month" button → calls /api/billing/checkout → redirects to returned URL.
  - If plan is 'pro': show "Manage subscription" button → calls /api/billing/portal → redirects.
  - On mount, if URL has `?upgraded=1`, show a green toast "Welcome to Pro!" and remove the param (use `router.replace`).
- `src/components/dashboard/insights-upgrade-card.tsx`: change the existing button to trigger the same checkout flow.

### 7. `.env.local.example` additions
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Tests
- `src/lib/billing/__tests__/stripe.test.ts`: `getOrCreateStripeCustomer` creates + reuses + persists; mocks the stripe client.
- `src/app/api/billing/checkout/__tests__/route.test.ts`: 401 no session, 409 already pro, 200 happy path returns url, demo mode skips Stripe.
- `src/app/api/billing/portal/__tests__/route.test.ts`: 401, 404 no customer, 200 happy path.
- `src/app/api/billing/webhook/__tests__/route.test.ts`: 400 bad signature, 200 + plan flip on session.completed, 200 + plan downgrade on subscription.deleted.

## Env vars (new)
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `NEXT_PUBLIC_BASE_URL`. List in `.env.local.example` AND mention in PR body so Augment sets them on Vercel.

## QA hook (post-deploy, for PR body)
1. Sign in as free user
2. Settings → Upgrade to Pro → redirect to Stripe Checkout → pay with test card `4242 4242 4242 4242`
3. Land back on Settings with welcome toast
4. SQL: `select subscription_tier from users where id=<your-uuid>` → `pro`
5. Click "Manage subscription" → Stripe portal opens
6. Cancel from portal → webhook fires → `subscription_tier='free'`

## Commit cadence — commit + push after EACH phase
1. `feat(billing): add billing_customers table + Stripe helper`
2. `feat(billing): add checkout + portal routes`
3. `feat(billing): add Stripe webhook handler`
4. `feat(ui): wire upgrade + manage buttons on Settings page`

Push after each commit. Open PR after commit 4.

## Done criteria
- 4 commits on `track-ii-stripe-pro-upgrade` pushed
- `npm test`, `npm run lint`, `npx tsc --noEmit`, `npx next build` all clean
- PR body lists the 4 new env vars + the QA hook
- Migration file exists but not applied (Augment applies via MCP)
