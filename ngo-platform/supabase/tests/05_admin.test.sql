begin;
select no_plan();
create extension if not exists pgtap with schema extensions;

-- Fixtures (rolled back at the end) ------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e1', 'editor@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'case@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f1', 'nobody@test.local', 'authenticated', 'authenticated');
insert into public.profiles (user_id, full_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin', 'admin'),
  ('00000000-0000-0000-0000-0000000000e1', 'Editor', 'editor'),
  ('00000000-0000-0000-0000-0000000000c1', 'Case worker', 'case_worker');

insert into public.media (id, storage_path, url) values
  ('00000000-0000-0000-0000-00000000d001', 'test/a.webp', 'http://x/a.webp');
insert into public.posts (id, slug, title, status) values
  ('00000000-0000-0000-0000-00000000b001', 'published-post', '{"ar": "منشور"}', 'published'),
  ('00000000-0000-0000-0000-00000000b002', 'draft-post', '{"ar": "مسودة"}', 'draft');
insert into public.post_media (post_id, media_id) values
  ('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-00000000d001');
insert into public.locales (code, name, dir, is_enabled, sort_order) values ('fr', 'Français', 'ltr', false, 2);

insert into public.request_types (id, slug, name) values
  ('00000000-0000-0000-0000-00000000a001', 'aid', '{"ar": "مساعدة"}');
insert into public.requests (id, type_id, tracking_code, full_name, phone, consent_given, locale) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000a001',
   'R-TEST-0001', 'Applicant', '+96170000000', true, 'ar');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select lives_ok($$ insert into public.locales (code, name, dir, sort_order) values ('de', 'Deutsch', 'ltr', 3) $$,
  'admin can add a language');
select lives_ok($$ update public.locales set is_enabled = true where code = 'fr' $$, 'admin can enable a language');
select lives_ok($$ update public.site_settings set modules = modules || '{"requests": true}' $$,
  'admin can switch modules');
select lives_ok($$ insert into public.request_types (slug, name) values ('training', '{"ar": "تدريب"}') $$,
  'admin can create request types');
select lives_ok($$ update public.profiles set role = 'case_worker' where user_id = '00000000-0000-0000-0000-0000000000e1' $$,
  'admin can change roles');
select is((select count(*)::int from public.profiles), 3, 'admin sees all profiles');
select lives_ok($$ delete from public.requests where tracking_code = 'R-TEST-0001' $$,
  'admin can delete a request');
reset role;

select is((select role::text from public.profiles where user_id = '00000000-0000-0000-0000-0000000000e1'),
  'case_worker', 'role change persisted');
select is((select (modules ->> 'requests')::boolean from public.site_settings), true, 'module change persisted');

select * from finish();
rollback;
