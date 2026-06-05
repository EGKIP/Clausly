-- Clausly v0.2 data layer.
-- Created manually because the Supabase CLI is not installed in this workspace.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.document_type as enum ('lease', 'auto', 'employment', 'service', 'nda', 'other');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_status as enum ('pending', 'analyzing', 'ready', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.risk_level as enum ('low', 'medium', 'high', 'needs_review');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.reminder_status as enum ('suggested', 'approved', 'sent', 'ignored');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.reminder_channel as enum ('email');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.date_kind as enum ('deadline', 'renewal', 'notice', 'payment', 'effective', 'end', 'review');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  default_state text,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'pro')),
  notification_preferences jsonb not null default '{"email": true}'::jsonb,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  party text,
  document_type public.document_type not null default 'other',
  jurisdiction text,
  page_count integer not null default 0 check (page_count >= 0),
  storage_path text not null,
  file_name text not null,
  mime_type text not null default 'application/pdf',
  file_size_bytes bigint not null default 0 check (file_size_bytes >= 0),
  status public.document_status not null default 'pending',
  risk_level public.risk_level,
  monthly_value numeric(12, 2),
  effective_date date,
  end_date date,
  notice_window_days integer check (notice_window_days is null or notice_window_days >= 0),
  summary_short text,
  summary text,
  tags text[] not null default '{}',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clauses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  title text not null,
  category text not null,
  risk_level public.risk_level not null default 'low',
  page_number integer not null default 1 check (page_number > 0),
  source_quote text not null,
  plain_english text not null,
  why_it_matters text,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  bbox jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  clause_id uuid references public.clauses(id) on delete set null,
  label text not null,
  date_value date not null,
  kind public.date_kind not null default 'deadline',
  description text,
  source_quote text,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  date_id uuid references public.dates(id) on delete set null,
  title text not null,
  description text not null,
  fire_on date not null,
  reminder_time time,
  status public.reminder_status not null default 'suggested',
  channel public.reminder_channel not null default 'email',
  reminder_type text not null default 'Review',
  source_quote text,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  job_type text not null,
  provider text,
  model text,
  input_token_count integer not null default 0 check (input_token_count >= 0),
  output_token_count integer not null default 0 check (output_token_count >= 0),
  status text not null default 'completed' check (status in ('completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists documents_user_created_idx on public.documents(user_id, created_at desc);
create index if not exists documents_user_status_idx on public.documents(user_id, status);
create index if not exists clauses_document_idx on public.clauses(document_id, page_number);
create index if not exists dates_document_idx on public.dates(document_id, date_value);
create index if not exists reminders_user_status_fire_idx on public.reminders(user_id, status, fire_on);
create index if not exists usage_metrics_user_created_idx on public.usage_metrics(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists clauses_set_updated_at on public.clauses;
create trigger clauses_set_updated_at
before update on public.clauses
for each row execute function public.set_updated_at();

drop trigger if exists dates_set_updated_at on public.dates;
create trigger dates_set_updated_at
before update on public.dates
for each row execute function public.set_updated_at();

drop trigger if exists reminders_set_updated_at on public.reminders;
create trigger reminders_set_updated_at
before update on public.reminders
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.documents enable row level security;
alter table public.clauses enable row level security;
alter table public.dates enable row level security;
alter table public.reminders enable row level security;
alter table public.usage_metrics enable row level security;

create policy "Users can read their profile"
on public.users for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can create their profile"
on public.users for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update their profile"
on public.users for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can delete their profile"
on public.users for delete
to authenticated
using ((select auth.uid()) = id);

create policy "Users can read their documents"
on public.documents for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their documents"
on public.documents for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their documents"
on public.documents for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their documents"
on public.documents for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read their clauses"
on public.clauses for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their clauses"
on public.clauses for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their clauses"
on public.clauses for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their clauses"
on public.clauses for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read their dates"
on public.dates for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their dates"
on public.dates for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their dates"
on public.dates for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their dates"
on public.dates for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read their reminders"
on public.reminders for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their reminders"
on public.reminders for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their reminders"
on public.reminders for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their reminders"
on public.reminders for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read their usage metrics"
on public.usage_metrics for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their usage metrics"
on public.usage_metrics for insert
to authenticated
with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 26214400, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their document files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can upload their document files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can update their document files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their document files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.users to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.clauses to authenticated;
grant select, insert, update, delete on public.dates to authenticated;
grant select, insert, update, delete on public.reminders to authenticated;
grant select, insert on public.usage_metrics to authenticated;
