create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_events enable row level security;

drop policy if exists "owners read own audit" on public.audit_events;
create policy "owners read own audit"
  on public.audit_events
  for select
  using (user_id = (select auth.uid()));

grant select on public.audit_events to authenticated;

create index if not exists audit_events_user_created_idx
  on public.audit_events (user_id, created_at desc);

create index if not exists audit_events_action_idx
  on public.audit_events (action);
