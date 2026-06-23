alter table public.users
  add column if not exists weekly_digest_sent_at timestamptz;

create table if not exists public.weekly_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  deadline_count integer not null default 0,
  upload_count integer not null default 0,
  high_risk_count integer not null default 0,
  status text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  error_message text
);

alter table public.weekly_digests enable row level security;

drop policy if exists "owners read own digests" on public.weekly_digests;
create policy "owners read own digests" on public.weekly_digests
  for select
  using (user_id = (select auth.uid()));

grant select on public.weekly_digests to authenticated;

create index if not exists weekly_digests_user_sent_idx
  on public.weekly_digests (user_id, sent_at desc);
