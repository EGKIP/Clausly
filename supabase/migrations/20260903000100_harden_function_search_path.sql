-- Harden function search_path per Supabase security advisor
-- (function_search_path_mutable). Pinning search_path prevents a
-- search_path hijack from redirecting unqualified references inside
-- these functions to attacker-controlled objects. No behavior change:
-- all table/type references in these functions already resolve within
-- `public`.
alter function public.set_updated_at() set search_path = public;
alter function public.match_document_chunks(uuid, vector, integer) set search_path = public;
alter function public.match_portfolio_chunks(vector, integer, integer) set search_path = public;

-- handle_new_user is only meant to run as the on_auth_user_created
-- trigger. The security advisor flags it as callable directly via
-- PostgREST RPC by anon/authenticated roles; revoke that unnecessary
-- surface (a direct call fails anyway outside trigger context, since it
-- references NEW, but least-privilege is cheap here).
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
