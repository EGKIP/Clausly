create table if not exists public.document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.document_shares enable row level security;

drop policy if exists "owners manage own shares" on public.document_shares;
create policy "owners manage own shares"
  on public.document_shares
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on public.document_shares to authenticated;

create index if not exists document_shares_token_idx
  on public.document_shares (token);

create index if not exists document_shares_user_created_idx
  on public.document_shares (user_id, created_at desc);
