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

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
set local request.headers to '{"x-forwarded-for": "203.0.113.7"}';

-- Content
select results_eq($$ select slug::text from public.posts order by slug $$,
  array['published-post'], 'anon sees published posts only (no drafts)');
select is_empty($$ select 1 from public.post_media $$, 'anon cannot see the album of a draft');
select results_eq($$ select code from public.locales order by sort_order $$,
  array['ar', 'en'], 'anon sees enabled locales only');
select is((select count(*)::int from public.sectors), 8, 'anon reads sectors');
select is((select count(*)::int from public.page_sections), 8, 'anon sees active sections only');

-- Requests are never readable
select throws_ok($$ select * from public.requests $$, '42501', null, 'anon cannot read requests');
select throws_ok($$ select * from public.request_events $$, '42501', null, 'anon cannot read request events');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select * from public.request_status_lookups $$, '42501', null, 'anon cannot read lookup log');
select throws_ok(
  $$ insert into public.requests (type_id, full_name, phone, consent_given, locale)
     values ('00000000-0000-0000-0000-00000000a001', 'X', '+96170123456', true, 'ar') $$,
  '42501', null, 'anon cannot insert requests directly'
);
select is_empty($$ select 1 from public.request_types $$, 'request types hidden while the module is off');
select is_empty($$ select * from public.check_request_status('R-TEST-0001', '+96170000000') $$,
  'status lookup returns nothing while the module is off');

-- No writes
select throws_ok($$ insert into public.posts (slug, title) values ('x', '{}') $$,
  '42501', null, 'anon cannot insert posts');
select throws_ok($$ select public.set_post_links('00000000-0000-0000-0000-00000000b001', '{}', '[]') $$,
  '42501', null, 'anon cannot call set_post_links');
update public.site_settings set org_name = '{"ar": "hacked"}';
reset role;
select is((select org_name ->> 'ar' from public.site_settings), 'اسم الجمعية', 'anon cannot update settings');

-- Module on: lookup works with code + phone, and is rate-limited
update public.site_settings set modules = modules || '{"requests": true}';
set local role anon;
select is((select count(*)::int from public.request_types), 1, 'open request types visible when module is on');
select results_eq(
  $$ select tracking_code, status::text from public.check_request_status(' r-test-0001 ', '+96170000000') $$,
  $$ values ('R-TEST-0001'::text, 'new'::text) $$,
  'status lookup works with tracking code + phone'
);
select is_empty($$ select * from public.check_request_status('R-TEST-0001', '+96179999999') $$,
  'wrong phone reveals nothing');
select ok(
  not exists (select 1 from public.check_request_status('R-TEST-0001', '+96170000000') s
              where s::text ilike '%Applicant%' or s::text ilike '%96170000000%'),
  'lookup never returns the name or phone'
);
-- 3 lookups so far; 7 more reach the limit of 10, so the 11th is refused.
select public.check_request_status('R-NOPE-0000', '+10000000') from generate_series(1, 7);
select throws_ok($$ select * from public.check_request_status('R-TEST-0001', '+96170000000') $$,
  'P0001', 'rate_limited', 'status lookup is rate-limited per client');
reset role;

select * from finish();
rollback;
