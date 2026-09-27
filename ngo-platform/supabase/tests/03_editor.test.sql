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
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated"}';

-- Content: full access
select lives_ok($$ insert into public.posts (slug, title) values ('editor-post', '{"ar": "نشاط"}') $$,
  'editor can create posts');
select is((select count(*)::int from public.posts), 3, 'editor sees drafts too');
select lives_ok($$ update public.sectors set name = name || '{"en": "Farming"}' where slug = 'agriculture' $$,
  'editor can edit sectors');
select lives_ok($$ insert into public.ui_strings (key, value) values ('test.key', '{"ar": "س"}') $$,
  'editor can add UI strings');
select lives_ok($$ update public.theme set primary_color = '#224466' $$, 'editor can change the theme');
select lives_ok($$ update public.site_settings set org_name = '{"ar": "جمعية", "en": "NGO"}' $$,
  'editor can change general settings');

select lives_ok(
  $$ select public.set_post_links('00000000-0000-0000-0000-00000000b001',
       array[(select id from public.sectors where slug = 'health')],
       '[{"media_id": "00000000-0000-0000-0000-00000000d001", "caption": {"ar": "صورة"}}]') $$,
  'editor can replace a post''s sectors and album'
);
select results_eq(
  $$ select (select count(*)::int from public.post_sectors where post_id = '00000000-0000-0000-0000-00000000b001'),
            (select caption ->> 'ar' from public.post_media where post_id = '00000000-0000-0000-0000-00000000b001') $$,
  $$ values (1, 'صورة'::text) $$,
  'set_post_links wrote sectors and captions'
);
select throws_ok(
  $$ select public.set_post_links('00000000-0000-0000-0000-00000000b001', '{}',
       '[{"media_id": "00000000-0000-0000-0000-00000000dead"}]') $$,
  '23503', null, 'a bad album entry rolls the whole replacement back'
);
select is((select count(*)::int from public.post_media where post_id = '00000000-0000-0000-0000-00000000b001'), 1,
  'album unchanged after the failed replacement');

-- Locales: read-only
select throws_ok($$ insert into public.locales (code, name) values ('de', 'Deutsch') $$,
  '42501', null, 'editor cannot add locales');
update public.locales set is_enabled = false where code = 'en';
delete from public.locales where code = 'en';
select is((select is_enabled from public.locales where code = 'en'), true,
  'editor cannot change or delete locales');

-- Modules: admin only
select throws_ok($$ update public.site_settings set modules = modules || '{"requests": true}' $$,
  '42501', 'Only an admin can change modules', 'editor cannot switch modules');

-- Requests: no access
select is_empty($$ select 1 from public.requests $$, 'editor cannot read requests');
select is_empty($$ select 1 from public.request_events $$, 'editor cannot read request events');
select throws_ok(
  $$ insert into public.requests (type_id, full_name, phone, consent_given, locale)
     values ('00000000-0000-0000-0000-00000000a001', 'X', '+96170123456', true, 'ar') $$,
  '42501', null, 'editor cannot insert requests'
);
update public.requests set status = 'approved';
select throws_ok($$ insert into public.request_types (slug, name) values ('x', '{}') $$,
  '42501', null, 'editor cannot create request types');

-- Profiles: own row only, and no self-promotion
select results_eq($$ select role::text from public.profiles $$, array['editor'], 'editor sees only own profile');
update public.profiles set role = 'admin';
reset role;
select is((select role::text from public.profiles where user_id = '00000000-0000-0000-0000-0000000000e1'),
  'editor', 'editor cannot promote themselves');
select is((select status::text from public.requests where tracking_code = 'R-TEST-0001'),
  'new', 'editor cannot change requests');

-- A signed-in user without an active profile gets public access only
update public.profiles set is_active = false where user_id = '00000000-0000-0000-0000-0000000000e1';
set local role authenticated;
select results_eq($$ select slug::text from public.posts order by slug $$, array['published-post'],
  'deactivated staff see published posts only');
select throws_ok($$ insert into public.posts (slug, title) values ('x2', '{}') $$,
  '42501', null, 'deactivated staff cannot write');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated"}';
select is_empty($$ select 1 from public.pages where status = 'draft' $$, 'users without a profile see no drafts');
reset role;

select * from finish();
rollback;
