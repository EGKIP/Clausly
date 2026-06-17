alter table public.users
  add column if not exists onboarding_tour_completed_at timestamptz;

comment on column public.users.onboarding_tour_completed_at is
  'Timestamp set after the user completes or skips the dashboard onboarding tour.';
