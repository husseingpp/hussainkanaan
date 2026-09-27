begin;
select plan(4);

insert into auth.users (id, email, aud, role, encrypted_password) values
  ('00000000-0000-0000-0000-0000000000e1', 'editor@test.local', 'authenticated', 'authenticated', 'old-hash');
insert into public.profiles (user_id, full_name, role, must_change_password) values
  ('00000000-0000-0000-0000-0000000000e1', 'Editor', 'editor', true);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated"}';

select is((select must_change_password from public.profiles), true, 'staff can read their own flag');
update public.profiles set must_change_password = false;
reset role;
select is((select must_change_password from public.profiles where user_id = '00000000-0000-0000-0000-0000000000e1'),
  true, 'staff cannot clear the flag themselves');

update auth.users set email = 'renamed@test.local' where id = '00000000-0000-0000-0000-0000000000e1';
select is((select must_change_password from public.profiles where user_id = '00000000-0000-0000-0000-0000000000e1'),
  true, 'other account changes keep the flag');

update auth.users set encrypted_password = 'new-hash' where id = '00000000-0000-0000-0000-0000000000e1';
select is((select must_change_password from public.profiles where user_id = '00000000-0000-0000-0000-0000000000e1'),
  false, 'changing the password clears the flag');

select * from finish();
rollback;
