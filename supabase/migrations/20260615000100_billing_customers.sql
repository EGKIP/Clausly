create table public.billing_customers (
  user_id uuid primary key references public.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

alter table public.billing_customers enable row level security;

create policy "Users can read their own billing customer row"
  on public.billing_customers for select
  using (user_id = (select auth.uid()));

grant select on public.billing_customers to authenticated;
