-- Base: enums, shared helpers, staff profiles and role checks.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'editor', 'case_worker');
create type public.content_status as enum ('draft', 'published');
create type public.text_dir as enum ('rtl', 'ltr');

-- A translatable value: a JSON object keyed by locale code, e.g. {"ar": "…", "en": "…"}.
-- Never add _ar/_en columns; add a locale row instead.
create domain public.i18n as jsonb
  check (value is null or jsonb_typeof(value) = 'object');

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (staff only; public sign-up is disabled, the admin creates users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Role of the calling user, or null for anon / inactive / unknown users.
-- security definer so policies can call it without recursing into profiles RLS.
create function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.user_id = (select auth.uid()) and p.is_active;
$$;

create function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$ select coalesce(public.current_user_role() = 'admin', false); $$;

-- Content staff: may write content and appearance.
create function public.is_editor()
returns boolean
language sql
stable
set search_path = ''
as $$ select coalesce(public.current_user_role() in ('admin', 'editor'), false); $$;

-- Request staff: may read and work requests.
create function public.is_case_worker()
returns boolean
language sql
stable
set search_path = ''
as $$ select coalesce(public.current_user_role() in ('admin', 'case_worker'), false); $$;

-- Any active staff member (read access to all admin data).
create function public.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$ select public.current_user_role() is not null; $$;

-- anon must be able to call it: public-read policies ask is_staff(), which is
-- false for anon (auth.uid() is null).
revoke execute on function public.current_user_role() from public;
grant execute on function public.current_user_role() to anon, authenticated;

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "profiles: admin insert" on public.profiles
  for insert to authenticated
  with check (public.is_admin());

create policy "profiles: admin update" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "profiles: admin delete" on public.profiles
  for delete to authenticated
  using (public.is_admin());

revoke all on public.profiles from anon;
