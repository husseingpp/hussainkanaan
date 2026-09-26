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
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}';

-- Requests: read and work them
select is((select count(*)::int from public.requests), 1, 'case worker reads requests');
select lives_ok(
  $$ update public.requests set status = 'in_review', priority = 'high',
       public_note = 'قيد المراجعة', assigned_to = '00000000-0000-0000-0000-0000000000c1'
     where tracking_code = 'R-TEST-0001' $$,
  'case worker can update a request'
);
select results_eq(
  $$ select event_type, actor_id from public.request_events
     where request_id = '00000000-0000-0000-0000-00000000f001' and event_type <> 'created'
     order by event_type $$,
  $$ values ('assigned'::text, '00000000-0000-0000-0000-0000000000c1'::uuid),
            ('priority_changed', '00000000-0000-0000-0000-0000000000c1'),
            ('public_note_changed', '00000000-0000-0000-0000-0000000000c1'),
            ('status_changed', '00000000-0000-0000-0000-0000000000c1') $$,
  'every change is logged, attributed to the case worker'
);
select results_eq(
  $$ select from_status::text, to_status::text from public.request_events where event_type = 'status_changed' $$,
  $$ values ('new'::text, 'in_review'::text) $$,
  'status change records from/to'
);
select lives_ok(
  $$ insert into public.request_events (request_id, event_type, data, actor_id)
     values ('00000000-0000-0000-0000-00000000f001', 'note', '{"text": "called back"}',
             '00000000-0000-0000-0000-0000000000c1') $$,
  'case worker can add a note as themselves'
);
select throws_ok(
  $$ insert into public.request_events (request_id, event_type, actor_id)
     values ('00000000-0000-0000-0000-00000000f001', 'note', '00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'case worker cannot write events as someone else'
);
update public.request_events set event_type = 'tampered';
delete from public.request_events;
delete from public.requests;
select is((select count(*)::int from public.request_events where event_type = 'tampered'), 0,
  'events cannot be edited');
select is((select count(*)::int from public.request_events), 6, 'events cannot be deleted');
select is((select count(*)::int from public.requests), 1, 'case worker cannot delete requests');

-- Content: read only
select is((select count(*)::int from public.posts), 2, 'case worker reads all posts');
select throws_ok($$ insert into public.posts (slug, title) values ('x', '{}') $$,
  '42501', null, 'case worker cannot create posts');
update public.site_settings set org_name = '{"ar": "x"}';
update public.site_settings set modules = '{}';
reset role;
select is((select modules ->> 'requests' from public.site_settings), 'false',
  'case worker cannot switch modules');
select is((select org_name ->> 'ar' from public.site_settings), 'اسم الجمعية',
  'case worker cannot change settings');

select * from finish();
rollback;
