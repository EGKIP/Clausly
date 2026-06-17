create table public.document_suggestions (
  document_id uuid primary key references public.documents(id) on delete cascade,
  suggestions jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

create table public.portfolio_suggestions (
  user_id uuid primary key references public.users(id) on delete cascade,
  suggestions jsonb not null default '[]'::jsonb,
  document_count integer not null default 0,
  generated_at timestamptz not null default now()
);

alter table public.document_suggestions enable row level security;
alter table public.portfolio_suggestions enable row level security;

create policy "owners read document suggestions"
  on public.document_suggestions for select
  using (
    document_id in (
      select id from public.documents
      where user_id = (select auth.uid())
    )
  );

create policy "owners insert document suggestions"
  on public.document_suggestions for insert
  with check (
    document_id in (
      select id from public.documents
      where user_id = (select auth.uid())
    )
  );

create policy "owners update document suggestions"
  on public.document_suggestions for update
  using (
    document_id in (
      select id from public.documents
      where user_id = (select auth.uid())
    )
  )
  with check (
    document_id in (
      select id from public.documents
      where user_id = (select auth.uid())
    )
  );

create policy "owners read portfolio suggestions"
  on public.portfolio_suggestions for select
  using (user_id = (select auth.uid()));

create policy "owners insert portfolio suggestions"
  on public.portfolio_suggestions for insert
  with check (user_id = (select auth.uid()));

create policy "owners update portfolio suggestions"
  on public.portfolio_suggestions for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on public.document_suggestions to authenticated;
grant select, insert, update on public.portfolio_suggestions to authenticated;
