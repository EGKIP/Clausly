-- document_exports had a SELECT-only RLS policy with no INSERT policy, so
-- every insert from the export route's request-scoped (RLS-bound) client
-- was silently rejected ("new row violates row-level security policy") and
-- swallowed by the caller's try/catch. Usage was never recorded, so
-- getExportUsage()/canExport() always saw 0 exports and free-plan users
-- could export past the stated 5-per-30-days limit.

create policy "Users can record their own exports" on public.document_exports
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
