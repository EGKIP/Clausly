-- Reconciles the repo's migration history with a policy already applied
-- directly to clausly-prod: POST /api/documents/[id]/export inserts into
-- document_exports using the user's session (not the service role), which
-- requires this INSERT policy to exist for the `authenticated` role.
drop policy if exists "Users can record their own exports" on public.document_exports;
create policy "Users can record their own exports" on public.document_exports
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

grant insert on public.document_exports to authenticated;
