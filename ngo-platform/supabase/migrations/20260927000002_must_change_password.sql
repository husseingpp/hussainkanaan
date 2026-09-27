-- Staff given a temporary password must choose their own on first sign-in.
-- The flag clears itself when auth.users' password actually changes, so a
-- staff member can't dismiss it without setting a new password.

alter table public.profiles
  add column must_change_password boolean not null default false;

create function public.clear_must_change_password()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
  set must_change_password = false
  where p.user_id = new.id and p.must_change_password;
  return new;
end;
$$;

revoke execute on function public.clear_must_change_password() from public, anon, authenticated;

create trigger on_auth_password_changed
  after update of encrypted_password on auth.users
  for each row
  when (new.encrypted_password is distinct from old.encrypted_password)
  execute function public.clear_must_change_password();
