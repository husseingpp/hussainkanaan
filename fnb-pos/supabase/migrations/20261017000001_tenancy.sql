-- Phase 0 · Tenancy: accounts, branches, devices, staff, roles, subscription, audit.
--
-- One shared database; every row carries tenant_id and row-level security
-- keeps each account inside its own rows even if the app has a bug
-- (BLUEPRINT.md, "Multi-tenant account model").
--
-- The signed-in user's account comes from the JWT: app_metadata.tenant_id,
-- written only by the server (sign-up / invite Edge Functions), never by the
-- client. app_metadata.tenant_admin marks the owner and managers who may edit
-- master data in the back office. Terminals never write these tables
-- directly: their uploads go through a validating Edge Function.

create schema if not exists app;
grant usage on schema app to authenticated, anon;

create or replace function app.tenant_id() returns uuid
language sql stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid
$$;

create or replace function app.is_tenant_admin() returns boolean
language sql stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'tenant_admin')::boolean, false)
$$;

create or replace function app.touch_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- Accounts --------------------------------------------------------------------

create table public.tenants (
  id            uuid primary key,
  name          text not null check (length(trim(name)) > 0),
  base_currency char(3) not null check (base_currency ~ '^[A-Z]{3}$'),
  country       char(2) not null check (country ~ '^[A-Z]{2}$'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.subscriptions (
  tenant_id     uuid primary key references public.tenants on delete cascade,
  plan          text not null check (plan in ('starter', 'pro', 'business')),
  status        text not null check (status in ('trialing', 'active', 'past_due', 'read_only', 'cancelled')),
  branch_limit  int  not null check (branch_limit > 0),
  device_limit  int  check (device_limit > 0), -- null = unlimited (Business)
  addons        jsonb not null default '[]',
  trial_ends_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.branches (
  id                  uuid primary key,
  tenant_id           uuid not null references public.tenants on delete cascade,
  name                text not null check (length(trim(name)) > 0),
  address             text,
  tax_registration_no text,
  timezone            text not null default 'UTC',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  unique (tenant_id, id)
);

create table public.devices (
  id             uuid primary key,
  tenant_id      uuid not null references public.tenants on delete cascade,
  branch_id      uuid not null,
  name           text not null,
  role           text not null check (role in ('pos', 'kds', 'hub')),
  mode           text not null default 'offline' check (mode in ('offline', 'online')),
  receipt_prefix text not null check (receipt_prefix ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
  paired_at      timestamptz,
  revoked_at     timestamptz,
  last_seen_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  -- Composite FK: a device can only point at a branch of its own account.
  foreign key (tenant_id, branch_id) references public.branches (tenant_id, id),
  unique (tenant_id, receipt_prefix)
);

-- One-time pairing codes shown in the back office; redeemed by the pairing
-- Edge Function (service role), which stores only the hash.
create table public.device_pairing_codes (
  id          uuid primary key,
  tenant_id   uuid not null references public.tenants on delete cascade,
  device_id   uuid not null references public.devices on delete cascade,
  code_hash   text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- People ----------------------------------------------------------------------

create table public.roles (
  id          uuid primary key,
  tenant_id   uuid not null references public.tenants on delete cascade,
  name        text not null,
  permissions text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, name)
);

-- Staff. One account-wide identity; terminal staff may have only a PIN, back
-- office users also link to a Supabase auth user.
create table public.users (
  id            uuid primary key,
  tenant_id     uuid not null references public.tenants on delete cascade,
  auth_user_id  uuid unique,
  display_name  text not null,
  email         text,
  pin_hash      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (tenant_id, id)
);

create table public.user_branch_roles (
  tenant_id  uuid not null references public.tenants on delete cascade,
  user_id    uuid not null,
  branch_id  uuid not null,
  role_id    uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, branch_id),
  foreign key (tenant_id, user_id)   references public.users    (tenant_id, id) on delete cascade,
  foreign key (tenant_id, branch_id) references public.branches (tenant_id, id) on delete cascade,
  foreign key (tenant_id, role_id)   references public.roles    (tenant_id, id)
);

-- System ----------------------------------------------------------------------

-- Append-only: voids, refunds, discounts, price edits, drawer opens, overrides.
create table public.audit_log (
  id         uuid primary key,
  tenant_id  uuid not null references public.tenants on delete cascade,
  user_id    uuid,
  device_id  uuid,
  action     text not null,
  entity     text,
  entity_id  uuid,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);

create index on public.branches (tenant_id);
create index on public.devices (tenant_id, branch_id);
create index on public.device_pairing_codes (tenant_id);
create index on public.roles (tenant_id);
create index on public.users (tenant_id);
create index on public.user_branch_roles (tenant_id);
create index on public.audit_log (tenant_id, created_at);

do $$
declare t text;
begin
  foreach t in array array['tenants', 'subscriptions', 'branches', 'devices', 'roles', 'users'] loop
    execute format('create trigger touch_updated_at before update on public.%I
                    for each row execute function app.touch_updated_at()', t);
  end loop;
end
$$;

-- Row-level security ----------------------------------------------------------

alter table public.tenants              enable row level security;
alter table public.subscriptions        enable row level security;
alter table public.branches             enable row level security;
alter table public.devices              enable row level security;
alter table public.device_pairing_codes enable row level security;
alter table public.roles                enable row level security;
alter table public.users                enable row level security;
alter table public.user_branch_roles    enable row level security;
alter table public.audit_log            enable row level security;

-- Nothing here is readable without signing in.
revoke all on all tables in schema public from anon;

-- The account row: members read it, admins rename it; created only by sign-up.
create policy tenant_read on public.tenants for select to authenticated
  using (id = app.tenant_id());
create policy tenant_update on public.tenants for update to authenticated
  using (id = app.tenant_id() and app.is_tenant_admin())
  with check (id = app.tenant_id());

-- Billing state is written only by the billing webhook (service role).
create policy subscription_read on public.subscriptions for select to authenticated
  using (tenant_id = app.tenant_id());

-- Master data: members read their own account's rows; admins edit them.
do $$
declare t text;
begin
  foreach t in array array['branches', 'devices', 'roles', 'users', 'user_branch_roles'] loop
    execute format('create policy member_read on public.%I for select to authenticated
                    using (tenant_id = app.tenant_id())', t);
    execute format('create policy admin_write on public.%I for all to authenticated
                    using (tenant_id = app.tenant_id() and app.is_tenant_admin())
                    with check (tenant_id = app.tenant_id() and app.is_tenant_admin())', t);
  end loop;
end
$$;

create policy admin_read on public.device_pairing_codes for select to authenticated
  using (tenant_id = app.tenant_id() and app.is_tenant_admin());
create policy admin_create on public.device_pairing_codes for insert to authenticated
  with check (tenant_id = app.tenant_id() and app.is_tenant_admin());

create policy audit_read on public.audit_log for select to authenticated
  using (tenant_id = app.tenant_id() and app.is_tenant_admin());
create policy audit_append on public.audit_log for insert to authenticated
  with check (tenant_id = app.tenant_id());
-- No update/delete policy: the audit log cannot be edited.
revoke update, delete on public.audit_log from authenticated;

-- PIN hashes never leave the server, even within the account. A column
-- revoke does not override a table grant, so grant the other columns instead.
revoke select on public.users from authenticated;
grant select (id, tenant_id, auth_user_id, display_name, email, created_at, updated_at, deleted_at)
  on public.users to authenticated;
