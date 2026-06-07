-- Account deletion RPC.
-- The application route removes physical Storage objects through the Storage
-- API before calling this function. This metadata delete is a defensive cleanup
-- for any remaining rows so auth.users deletion is not blocked by ownership.

create or replace function public.delete_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, storage
as $$
begin
  if auth.uid() is null or auth.uid() <> target_user_id then
    raise exception 'Cannot delete another user account.'
      using errcode = '42501';
  end if;

  delete from storage.objects
  where bucket_id = 'documents'
    and (storage.foldername(name))[1] = target_user_id::text;

  delete from auth.users
  where id = target_user_id;
end;
$$;

revoke all on function public.delete_account(uuid) from public;
grant execute on function public.delete_account(uuid) to authenticated;
