create table if not exists public.document_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  format text not null check (format in ('pdf', 'csv')),
  created_at timestamptz not null default now()
);

alter table public.document_exports enable row level security;

drop policy if exists "owners read own exports" on public.document_exports;
create policy "owners read own exports" on public.document_exports
  for select
  using (user_id = (select auth.uid()));

grant select on public.document_exports to authenticated;

create index if not exists document_exports_user_created_idx
  on public.document_exports (user_id, created_at desc);
