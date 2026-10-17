-- Cross-tenant isolation (BLUEPRINT.md, "Security, compliance and reliability"):
-- a signed-in user sees and edits only their own account's rows.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(16);

-- Two accounts, A and B, each with a branch, a device, a role and a staff user.
insert into tenants (id, name, base_currency, country) values
  ('00000000-0000-7000-8000-00000000000a', 'Cafe A', 'USD', 'LB'),
  ('00000000-0000-7000-8000-00000000000b', 'Bistro B', 'EUR', 'FR');
insert into subscriptions (tenant_id, plan, status, branch_limit) values
  ('00000000-0000-7000-8000-00000000000a', 'pro', 'trialing', 1),
  ('00000000-0000-7000-8000-00000000000b', 'starter', 'active', 1);
insert into branches (id, tenant_id, name) values
  ('00000000-0000-7000-8000-0000000000a1', '00000000-0000-7000-8000-00000000000a', 'Hamra'),
  ('00000000-0000-7000-8000-0000000000b1', '00000000-0000-7000-8000-00000000000b', 'Marais');
insert into devices (id, tenant_id, branch_id, name, role, receipt_prefix) values
  ('00000000-0000-7000-8000-0000000a1001', '00000000-0000-7000-8000-00000000000a', '00000000-0000-7000-8000-0000000000a1', 'Till 1', 'pos', 'B1-T1'),
  ('00000000-0000-7000-8000-0000000b1001', '00000000-0000-7000-8000-00000000000b', '00000000-0000-7000-8000-0000000000b1', 'Till 1', 'pos', 'B1-T1');
insert into users (id, tenant_id, display_name, pin_hash) values
  ('00000000-0000-7000-8000-00000000a0a0', '00000000-0000-7000-8000-00000000000a', 'Rana', 'hash-a'),
  ('00000000-0000-7000-8000-00000000b0b0', '00000000-0000-7000-8000-00000000000b', 'Luc', 'hash-b');

-- A device cannot point at another account's branch.
select throws_ok(
  $$insert into devices (id, tenant_id, branch_id, name, role, receipt_prefix) values
    ('00000000-0000-7000-8000-0000000a1002', '00000000-0000-7000-8000-00000000000a',
     '00000000-0000-7000-8000-0000000000b1', 'Sneaky', 'pos', 'B1-T9')$$,
  '23503', null, 'composite FK keeps devices inside their account');

-- Signed in as staff of A (not an admin).
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-7000-8000-0000000000aa","role":"authenticated","app_metadata":{"tenant_id":"00000000-0000-7000-8000-00000000000a"}}', true);

select results_eq('select name from tenants', $$values ('Cafe A')$$, 'staff see only their account');
select results_eq('select name from branches', $$values ('Hamra')$$, 'staff see only their branches');
select is((select count(*)::int from devices), 1, 'staff see only their devices');
select is((select count(*)::int from subscriptions), 1, 'staff see only their subscription');
select throws_ok('select pin_hash from users', '42501', null, 'PIN hashes are not readable');
select results_eq('select display_name from users', $$values ('Rana')$$, 'staff see only their account''s users');

-- Staff cannot edit master data; the update silently matches no rows.
update branches set name = 'Renamed' where id = '00000000-0000-7000-8000-0000000000a1';
select results_eq('select name from branches', $$values ('Hamra')$$, 'staff cannot edit branches');

-- Signed in as an admin of A.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-7000-8000-0000000000aa","role":"authenticated","app_metadata":{"tenant_id":"00000000-0000-7000-8000-00000000000a","tenant_admin":true}}', true);

update branches set name = 'Hamra Street' where id = '00000000-0000-7000-8000-0000000000a1';
select results_eq('select name from branches', $$values ('Hamra Street')$$, 'admins edit their own branches');

-- Writing into, or reaching, account B fails.
select throws_ok(
  $$insert into branches (id, tenant_id, name) values
    ('00000000-0000-7000-8000-0000000000b2', '00000000-0000-7000-8000-00000000000b', 'Planted')$$,
  '42501', null, 'admins cannot insert into another account');
update branches set name = 'Hacked' where tenant_id = '00000000-0000-7000-8000-00000000000b';
delete from users where tenant_id = '00000000-0000-7000-8000-00000000000b';
select throws_ok('insert into subscriptions (tenant_id, plan, status, branch_limit) values (''00000000-0000-7000-8000-00000000000a'', ''business'', ''active'', 99)',
  '42501', null, 'billing state is not client-writable');

-- Audit log is append-only.
insert into audit_log (id, tenant_id, action) values ('00000000-0000-7000-8000-00000000ad01', '00000000-0000-7000-8000-00000000000a', 'void');
select is((select count(*)::int from audit_log), 1, 'audit entries can be appended');
select throws_ok('delete from audit_log', '42501', null, 'audit entries cannot be deleted');
select throws_ok(
  $$insert into audit_log (id, tenant_id, action) values ('00000000-0000-7000-8000-00000000ad02', '00000000-0000-7000-8000-00000000000b', 'void')$$,
  '42501', null, 'audit entries cannot be written into another account');

-- No account claim at all: nothing is visible.
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select is((select count(*)::int from branches), 0, 'no tenant claim, no rows');

reset role;
select results_eq(
  $$select name from branches where tenant_id = '00000000-0000-7000-8000-00000000000b'$$,
  $$values ('Marais')$$, 'account B was untouched');

select * from finish();
rollback;
