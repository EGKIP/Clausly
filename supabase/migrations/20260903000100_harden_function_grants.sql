-- Harden function privileges flagged by the Supabase security linter.
--
-- delete_account already checks auth.uid() internally and cannot be used to
-- delete another account, but the live database currently grants EXECUTE to
-- anon/PUBLIC (drift from the original migration's revoke). Tighten it back
-- to authenticated-only as defense in depth.
--
-- handle_new_user and set_updated_at are trigger functions only ever invoked
-- by their triggers (which run with definer rights regardless of grants), so
-- they never need direct EXECUTE access from API roles.
--
-- match_document_chunks / match_portfolio_chunks already filter by
-- auth.uid() in their bodies, so anon calls already return no rows; the
-- search_path pin below just removes reliance on an implicit search_path for
-- the vector extension's operators.

revoke execute on function public.delete_account(uuid) from public, anon;
grant execute on function public.delete_account(uuid) to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter function public.set_updated_at() set search_path = public;
alter function public.match_document_chunks(uuid, vector, integer) set search_path = public;
alter function public.match_portfolio_chunks(vector, integer, integer) set search_path = public;
