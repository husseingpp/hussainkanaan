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

-- Every table in public has RLS on, and every one except internal bookkeeping has policies.
select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'RLS is enabled on every public table'
);
select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and c.relname <> 'request_status_lookups'
       and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) $$,
  'every public table has explicit policies'
);
select policies_are('storage', 'objects', array[
  'public-images: public read', 'public-images: editor insert',
  'public-images: editor update', 'public-images: editor delete'
], 'storage bucket policies');
select ok((select public from storage.buckets where id = 'public-images'), 'public-images bucket is public');

-- tr() fallback
select is(public.tr('{"ar": "عربي", "en": "English"}', 'en'), 'English', 'tr: requested locale');
select is(public.tr('{"ar": "عربي"}', 'en'), 'عربي', 'tr: falls back to the default locale');
select is(public.tr('{"en": ""}', 'en'), '', 'tr: empty when nothing is available');
select is(public.tr(null, 'en'), '', 'tr: null field');

-- Constraints
select throws_ok(
  $$ insert into public.locales (code, name, is_default) values ('de', 'Deutsch', true) $$,
  '23505', null, 'only one default locale'
);
select throws_ok(
  $$ insert into public.posts (slug, title) values ('Bad Slug!', '{}') $$,
  '23514', null, 'slugs must be kebab-case'
);
select throws_ok(
  $$ insert into public.posts (slug, title) values ('x', '"not an object"') $$,
  '23514', null, 'i18n fields must be objects'
);
select throws_ok(
  $$ insert into public.requests (type_id, full_name, phone, consent_given, locale)
     values ('00000000-0000-0000-0000-00000000a001', 'X', '70123456', true, 'ar') $$,
  '23514', null, 'phones must be E.164'
);
select throws_ok(
  $$ insert into public.requests (type_id, full_name, phone, consent_given, locale)
     values ('00000000-0000-0000-0000-00000000a001', 'X', '+96170123456', false, 'ar') $$,
  '23514', null, 'consent is required'
);
select matches(public.generate_tracking_code(), '^R-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$',
  'tracking codes use the unambiguous alphabet');

-- published_at is stamped on publish
update public.posts set status = 'published' where id = '00000000-0000-0000-0000-00000000b002';
select isnt((select published_at from public.posts where id = '00000000-0000-0000-0000-00000000b002'),
  null, 'publishing stamps published_at');

-- Menu: one dropdown level only
insert into public.nav_items (id, label, link_type, target) values
  ('00000000-0000-0000-0000-0000000c0001', '{}', 'route', '/a');
insert into public.nav_items (id, label, link_type, target, parent_id) values
  ('00000000-0000-0000-0000-0000000c0002', '{}', 'route', '/b', '00000000-0000-0000-0000-0000000c0001');
select throws_ok(
  $$ insert into public.nav_items (label, link_type, target, parent_id)
     values ('{}', 'route', '/c', '00000000-0000-0000-0000-0000000c0002') $$,
  'P0001', 'Menu items support one dropdown level only', 'menus are one level deep'
);

-- Audit trail is append-only, even for the table owner
select throws_ok(
  $$ update public.request_events set event_type = 'tampered' $$,
  '42501', 'request_events is append-only', 'request_events cannot be updated'
);
select is(
  (select count(*)::int from public.request_events where request_id = '00000000-0000-0000-0000-00000000f001' and event_type = 'created'),
  1, 'inserting a request logs a created event'
);

select * from finish();
rollback;
