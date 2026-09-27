begin;
select no_plan();
create extension if not exists pgtap with schema extensions;

-- A form with every field type.
insert into public.request_types (id, slug, name, form_schema) values (
  '00000000-0000-0000-0000-00000000a0f1', 'volunteer', '{"ar": "تطوع"}',
  '[
    {"key": "age", "type": "number", "required": true, "label": {"ar": "العمر"}},
    {"key": "email", "type": "email", "required": false, "label": {"ar": "البريد"}},
    {"key": "start", "type": "date", "required": false, "label": {"ar": "التاريخ"}},
    {"key": "area", "type": "select", "required": true, "label": {"ar": "المنطقة"},
     "options": [{"value": "north", "label": {"ar": "الشمال"}}, {"value": "south", "label": {"ar": "الجنوب"}}]},
    {"key": "skills", "type": "checkboxes", "required": false, "label": {"ar": "المهارات"},
     "options": [{"value": "teach", "label": {"ar": "تعليم"}}, {"value": "cook", "label": {"ar": "طبخ"}}]},
    {"key": "notes", "type": "textarea", "required": false, "label": {"ar": "ملاحظات"}}
  ]'
);
insert into public.request_types (slug, name, is_open) values ('closed-form', '{"ar": "مغلق"}', false);

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
set local request.headers to '{"x-forwarded-for": "198.51.100.9"}';

select throws_ok(
  $$ select public.submit_request('volunteer', 'سارة', '+96170111222', '{"age": 20, "area": "north"}', true, 'ar') $$,
  'P0001', 'requests_closed', 'module off: submissions refused'
);
reset role;
update public.site_settings set modules = modules || '{"requests": true}';
set local role anon;

select throws_ok($$ select public.submit_request('closed-form', 'سارة', '+96170111222', '{}', true, 'ar') $$,
  'P0001', 'form_closed', 'closed form refused');
select throws_ok($$ select public.submit_request('volunteer', 'سارة', '+96170111222', '{"area": "north"}', true, 'ar') $$,
  'P0001', 'missing:age', 'required field enforced');
select throws_ok($$ select public.submit_request('volunteer', 'سارة', '+96170111222', '{"age": "abc", "area": "north"}', true, 'ar') $$,
  'P0001', 'invalid:age', 'number validated');
select throws_ok($$ select public.submit_request('volunteer', 'سارة', '+96170111222', '{"age": 20, "area": "east"}', true, 'ar') $$,
  'P0001', 'invalid:area', 'select must be one of the options');
select throws_ok($$ select public.submit_request('volunteer', 'سارة', '+96170111222', '{"age": 20, "area": "north", "skills": ["hack"]}', true, 'ar') $$,
  'P0001', 'invalid:skills', 'checkboxes must be options');
select throws_ok($$ select public.submit_request('volunteer', 'سارة', '+96170111222', '{"age": 20, "area": "north", "start": "2026-02-30"}', true, 'ar') $$,
  'P0001', 'invalid:start', 'impossible date refused with a friendly error');
select throws_ok($$ select public.submit_request('volunteer', 'سارة', '70111222', '{"age": 20, "area": "north"}', true, 'ar') $$,
  'P0001', 'invalid:phone', 'phone must be E.164');
select throws_ok($$ select public.submit_request('volunteer', 'سارة', '+96170111222', '{"age": 20, "area": "north"}', false, 'ar') $$,
  'P0001', 'consent_required', 'consent required');
select throws_ok($$ select public.submit_request('volunteer', 'س', '+96170111222', '{"age": 20, "area": "north"}', true, 'ar') $$,
  'P0001', 'invalid:full_name', 'name required');

select matches(
  public.submit_request('volunteer', ' سارة ', '+96170111222',
    '{"age": "21", "area": "south", "skills": ["teach", "cook"], "email": "s@example.org", "injected": "<script>"}', true, 'en'),
  '^R-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$', 'valid submission returns a tracking code'
);
reset role;
select results_eq(
  $$ select full_name, answers, locale, status::text from public.requests where type_id = '00000000-0000-0000-0000-00000000a0f1' $$,
  $$ values ('سارة'::text, '{"age": 21, "area": "south", "email": "s@example.org", "skills": ["teach", "cook"]}'::jsonb, 'en'::text, 'new'::text) $$,
  'stored answers are cleaned: typed, trimmed, unknown keys dropped'
);
select is((select count(*)::int from public.request_events e join public.requests r on r.id = e.request_id
           where r.type_id = '00000000-0000-0000-0000-00000000a0f1' and e.event_type = 'created'), 1,
  'submission logs a created event');

-- Anon still can't read what it submitted.
set local role anon;
select throws_ok($$ select * from public.requests $$, '42501', null, 'anon still cannot read requests');

-- Rate limit: 5 accepted per 10 minutes per client (1 so far).
select public.submit_request('volunteer', 'سارة', '+96170111222', '{"age": 20, "area": "north"}', true, 'ar') from generate_series(1, 4);
select throws_ok($$ select public.submit_request('volunteer', 'سارة', '+96170111222', '{"age": 20, "area": "north"}', true, 'ar') $$,
  'P0001', 'rate_limited', 'sixth submission within 10 minutes is refused');
reset role;

select * from finish();
rollback;
