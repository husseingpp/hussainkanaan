-- Requests module (switchable via site_settings.modules.requests).
-- Requests are never publicly readable: status lookup goes only through
-- check_request_status(). Submissions are inserted with the service role.

create type public.request_status as enum
  ('new', 'in_review', 'approved', 'rejected', 'fulfilled', 'closed');
create type public.request_priority as enum ('low', 'normal', 'high', 'urgent');

-- ---------------------------------------------------------------------------
-- Request types (each with its own form)
-- ---------------------------------------------------------------------------
create table public.request_types (
  id uuid primary key default gen_random_uuid(),
  slug public.slug not null unique,
  name public.i18n not null default '{}',
  description public.i18n not null default '{}',
  icon text,
  -- [{key, label: i18n, type, required, options: [{value, label: i18n}]}]
  form_schema jsonb not null default '[]' check (jsonb_typeof(form_schema) = 'array'),
  is_open boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger request_types_updated_at before update on public.request_types
  for each row execute function public.set_updated_at();

alter table public.request_types enable row level security;

create policy "request_types: read open" on public.request_types
  for select to anon, authenticated
  using ((is_open and public.requests_enabled()) or public.is_staff());
create policy "request_types: admin insert" on public.request_types
  for insert to authenticated with check (public.is_admin());
create policy "request_types: admin update" on public.request_types
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "request_types: admin delete" on public.request_types
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Requests
-- ---------------------------------------------------------------------------
-- Unambiguous alphabet (no 0/O, 1/I): R-XXXX-XXXX.
create function public.generate_tracking_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  code text := '';
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    if i = 3 then code := code || '-'; end if;
  end loop;
  return 'R-' || code;
end;
$$;

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  type_id uuid not null references public.request_types (id) on delete restrict,
  tracking_code text not null unique default public.generate_tracking_code(),
  full_name text not null check (full_name <> ''),
  phone text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  region text,
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  status public.request_status not null default 'new',
  priority public.request_priority not null default 'normal',
  assigned_to uuid references public.profiles (user_id) on delete set null,
  public_note text,
  consent_given boolean not null check (consent_given),
  locale text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index requests_inbox_idx on public.requests (status, created_at desc);
create index requests_assigned_idx on public.requests (assigned_to);

create trigger requests_updated_at before update on public.requests
  for each row execute function public.set_updated_at();

alter table public.requests enable row level security;

create policy "requests: staff read" on public.requests
  for select to authenticated using (public.is_case_worker());
create policy "requests: admin insert" on public.requests
  for insert to authenticated with check (public.is_admin());
create policy "requests: staff update" on public.requests
  for update to authenticated using (public.is_case_worker()) with check (public.is_case_worker());
create policy "requests: admin delete" on public.requests
  for delete to authenticated using (public.is_admin());

revoke all on public.requests from anon;

-- ---------------------------------------------------------------------------
-- Request events: append-only audit trail
-- ---------------------------------------------------------------------------
create table public.request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  -- created | status_changed | priority_changed | assigned | public_note_changed | note
  event_type text not null check (event_type ~ '^[a-z_]+$'),
  from_status public.request_status,
  to_status public.request_status,
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  actor_id uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index request_events_request_idx on public.request_events (request_id, created_at);

create function public.block_request_event_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'request_events is append-only' using errcode = '42501';
end;
$$;

create trigger request_events_append_only before update on public.request_events
  for each row execute function public.block_request_event_update();

alter table public.request_events enable row level security;

create policy "request_events: staff read" on public.request_events
  for select to authenticated using (public.is_case_worker());
-- Staff may add manual notes; they're always attributed to themselves.
create policy "request_events: staff insert" on public.request_events
  for insert to authenticated
  with check (public.is_case_worker() and actor_id = (select auth.uid()));

revoke all on public.request_events from anon;

-- Every request change is logged automatically (CLAUDE.md rule 13).
create function public.log_request_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.request_events (request_id, event_type, to_status, actor_id)
    values (new.id, 'created', new.status, actor);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.request_events (request_id, event_type, from_status, to_status, actor_id)
    values (new.id, 'status_changed', old.status, new.status, actor);
  end if;
  if new.priority is distinct from old.priority then
    insert into public.request_events (request_id, event_type, data, actor_id)
    values (new.id, 'priority_changed',
            jsonb_build_object('from', old.priority, 'to', new.priority), actor);
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.request_events (request_id, event_type, data, actor_id)
    values (new.id, 'assigned',
            jsonb_build_object('from', old.assigned_to, 'to', new.assigned_to), actor);
  end if;
  if new.public_note is distinct from old.public_note then
    insert into public.request_events (request_id, event_type, data, actor_id)
    values (new.id, 'public_note_changed', jsonb_build_object('to', new.public_note), actor);
  end if;
  return new;
end;
$$;

create trigger requests_log_insert after insert on public.requests
  for each row execute function public.log_request_event();
create trigger requests_log_update after update on public.requests
  for each row execute function public.log_request_event();

-- ---------------------------------------------------------------------------
-- Public status lookup (tracking code + phone), rate-limited
-- ---------------------------------------------------------------------------
create table public.request_status_lookups (
  id bigint generated always as identity primary key,
  client_key text not null,
  tracking_code text not null,
  created_at timestamptz not null default now()
);

create index request_status_lookups_client_idx on public.request_status_lookups (client_key, created_at);
create index request_status_lookups_code_idx on public.request_status_lookups (tracking_code, created_at);

-- Internal bookkeeping: no policies, so only security-definer code can touch it.
alter table public.request_status_lookups enable row level security;
revoke all on public.request_status_lookups from anon, authenticated;

create function public.check_request_status(p_tracking_code text, p_phone text)
returns table (
  tracking_code text,
  status public.request_status,
  public_note text,
  type_name jsonb,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  client text := coalesce(
    nullif(trim(split_part(headers ->> 'x-forwarded-for', ',', 1)), ''),
    headers ->> 'cf-connecting-ip',
    'unknown'
  );
  code text := upper(trim(coalesce(p_tracking_code, '')));
begin
  if not public.requests_enabled() then
    return;
  end if;

  delete from public.request_status_lookups l where l.created_at < now() - interval '1 day';

  -- 10 lookups per 10 minutes per client, 20 per hour per tracking code.
  if (select count(*) from public.request_status_lookups l
      where l.client_key = client and l.created_at > now() - interval '10 minutes') >= 10
     or (select count(*) from public.request_status_lookups l
         where l.tracking_code = code and l.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'Try again later';
  end if;

  insert into public.request_status_lookups (client_key, tracking_code) values (client, code);

  return query
    select r.tracking_code, r.status, r.public_note, t.name::jsonb, r.updated_at
    from public.requests r
    join public.request_types t on t.id = r.type_id
    where r.tracking_code = code and r.phone = trim(coalesce(p_phone, ''));
end;
$$;

revoke execute on function public.check_request_status(text, text) from public;
grant execute on function public.check_request_status(text, text) to anon, authenticated;
