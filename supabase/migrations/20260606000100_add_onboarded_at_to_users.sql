alter table public.users
  add column if not exists onboarded_at timestamptz;

comment on column public.users.onboarded_at is
  'Timestamp set after the user completes the first-run Clausly welcome flow.';
