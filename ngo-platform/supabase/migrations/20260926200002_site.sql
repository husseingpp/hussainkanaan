-- Languages, UI strings, site settings, theme, menu, hero slides, page sections.

-- ---------------------------------------------------------------------------
-- Locales (languages are data: adding one needs no schema change or deploy)
-- ---------------------------------------------------------------------------
create table public.locales (
  code text primary key check (code ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  name text not null check (name <> ''),
  dir public.text_dir not null default 'ltr',
  is_default boolean not null default false,
  is_enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locales_default_is_enabled check (not is_default or is_enabled)
);

-- Exactly one default locale.
create unique index locales_one_default on public.locales (is_default) where is_default;

create trigger locales_updated_at before update on public.locales
  for each row execute function public.set_updated_at();

alter table public.locales enable row level security;

create policy "locales: read enabled" on public.locales
  for select to anon, authenticated
  using (is_enabled or public.is_staff());

create policy "locales: admin insert" on public.locales
  for insert to authenticated with check (public.is_admin());
create policy "locales: admin update" on public.locales
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "locales: admin delete" on public.locales
  for delete to authenticated using (public.is_admin());

-- Reads a locale map with the same fallback as the app's tr():
-- requested locale → default locale → ''.
-- Takes jsonb (not the i18n domain) so generated types stay precise.
create function public.tr(field jsonb, locale text)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(field ->> locale, ''),
    nullif(field ->> (select l.code from public.locales l where l.is_default), ''),
    ''
  );
$$;

-- ---------------------------------------------------------------------------
-- UI strings (next-intl messages; code defaults/*.json are the final fallback)
-- ---------------------------------------------------------------------------
create table public.ui_strings (
  key text primary key check (key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),
  value public.i18n not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ui_strings_updated_at before update on public.ui_strings
  for each row execute function public.set_updated_at();

alter table public.ui_strings enable row level security;

create policy "ui_strings: public read" on public.ui_strings
  for select to anon, authenticated using (true);
create policy "ui_strings: editor insert" on public.ui_strings
  for insert to authenticated with check (public.is_editor());
create policy "ui_strings: editor update" on public.ui_strings
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "ui_strings: editor delete" on public.ui_strings
  for delete to authenticated using (public.is_editor());

-- ---------------------------------------------------------------------------
-- Site settings (singleton)
-- ---------------------------------------------------------------------------
create table public.site_settings (
  id int primary key default 1 check (id = 1),
  org_name public.i18n not null default '{}',
  tagline public.i18n not null default '{}',
  logo_url text,
  logo_dark_url text,
  favicon_url text,
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  email text,
  address public.i18n not null default '{}',
  map_embed_url text,
  socials jsonb not null default '{}' check (jsonb_typeof(socials) = 'object'),
  donate_info public.i18n not null default '{}',
  footer_text public.i18n not null default '{}',
  modules jsonb not null default '{"requests": false, "donate": true, "facebook_feed": false}'
    check (jsonb_typeof(modules) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

-- Only admins may switch modules on/off. Service-role and migration
-- contexts (no auth.uid()) are allowed.
create function public.guard_site_modules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.modules is distinct from old.modules
     and (select auth.uid()) is not null
     and not public.is_admin() then
    raise exception 'Only an admin can change modules' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger site_settings_guard_modules before update on public.site_settings
  for each row execute function public.guard_site_modules();

-- Is the requests module switched on?
create function public.requests_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (s.modules ->> 'requests')::boolean from public.site_settings s where s.id = 1), false);
$$;

alter table public.site_settings enable row level security;

create policy "site_settings: public read" on public.site_settings
  for select to anon, authenticated using (true);
create policy "site_settings: admin insert" on public.site_settings
  for insert to authenticated with check (public.is_admin());
create policy "site_settings: editor update" on public.site_settings
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "site_settings: admin delete" on public.site_settings
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Theme (singleton). Applied as CSS variables; see src/lib/theme.
-- ---------------------------------------------------------------------------
create table public.theme (
  id int primary key default 1 check (id = 1),
  primary_color text not null default '#1F6F4A' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#C98A2B' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#2B7A9E' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_color text not null default '#FAF8F3' check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  text_color text not null default '#1C2420' check (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  font_arabic text not null default 'ibm_plex_arabic'
    check (font_arabic in ('ibm_plex_arabic', 'cairo', 'tajawal', 'noto_kufi')),
  font_latin text not null default 'inter'
    check (font_latin in ('inter', 'poppins', 'noto_sans')),
  radius text not null default 'md' check (radius in ('none', 'sm', 'md', 'lg', 'full')),
  header_style text not null default 'transparent_over_hero'
    check (header_style in ('light', 'dark', 'transparent_over_hero')),
  footer_style text not null default 'dark' check (footer_style in ('light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger theme_updated_at before update on public.theme
  for each row execute function public.set_updated_at();

alter table public.theme enable row level security;

create policy "theme: public read" on public.theme
  for select to anon, authenticated using (true);
create policy "theme: admin insert" on public.theme
  for insert to authenticated with check (public.is_admin());
create policy "theme: editor update" on public.theme
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "theme: admin delete" on public.theme
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------
create type public.nav_link_type as enum ('page', 'sector', 'route', 'external');

create table public.nav_items (
  id uuid primary key default gen_random_uuid(),
  label public.i18n not null default '{}',
  link_type public.nav_link_type not null,
  target text not null,
  parent_id uuid references public.nav_items (id) on delete cascade,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nav_items_not_own_parent check (parent_id is distinct from id)
);

create index nav_items_parent_idx on public.nav_items (parent_id, sort_order);

create trigger nav_items_updated_at before update on public.nav_items
  for each row execute function public.set_updated_at();

-- One dropdown level only: a child's parent must be top-level.
create function public.check_nav_depth()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null and exists (
    select 1 from public.nav_items p where p.id = new.parent_id and p.parent_id is not null
  ) then
    raise exception 'Menu items support one dropdown level only';
  end if;
  if new.parent_id is not null and exists (
    select 1 from public.nav_items c where c.parent_id = new.id
  ) then
    raise exception 'An item with children cannot become a child';
  end if;
  return new;
end;
$$;

create trigger nav_items_depth before insert or update of parent_id on public.nav_items
  for each row execute function public.check_nav_depth();

alter table public.nav_items enable row level security;

create policy "nav_items: read active" on public.nav_items
  for select to anon, authenticated using (is_active or public.is_staff());
create policy "nav_items: editor insert" on public.nav_items
  for insert to authenticated with check (public.is_editor());
create policy "nav_items: editor update" on public.nav_items
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "nav_items: editor delete" on public.nav_items
  for delete to authenticated using (public.is_editor());

-- ---------------------------------------------------------------------------
-- Hero slides
-- ---------------------------------------------------------------------------
create table public.hero_slides (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  title public.i18n not null default '{}',
  subtitle public.i18n not null default '{}',
  cta_label public.i18n not null default '{}',
  cta_link text,
  overlay_opacity int not null default 40 check (overlay_opacity between 0 and 80),
  text_position text not null default 'start' check (text_position in ('start', 'center', 'end')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger hero_slides_updated_at before update on public.hero_slides
  for each row execute function public.set_updated_at();

alter table public.hero_slides enable row level security;

create policy "hero_slides: read active" on public.hero_slides
  for select to anon, authenticated using (is_active or public.is_staff());
create policy "hero_slides: editor insert" on public.hero_slides
  for insert to authenticated with check (public.is_editor());
create policy "hero_slides: editor update" on public.hero_slides
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "hero_slides: editor delete" on public.hero_slides
  for delete to authenticated using (public.is_editor());

-- ---------------------------------------------------------------------------
-- Page sections: the homepage (and any page) is an ordered list of these.
-- Adding a type = new enum value + component + Zod schema + registry + admin form + seed.
-- ---------------------------------------------------------------------------
create type public.section_type as enum (
  'hero_slider', 'about_intro', 'objectives', 'sectors_grid', 'latest_activities',
  'events_strip', 'stats', 'gallery', 'partners', 'cta_banner', 'facebook_feed',
  'request_cta', 'rich_text'
);

create table public.page_sections (
  id uuid primary key default gen_random_uuid(),
  page_key text not null default 'home',  -- 'home' or a custom page id
  section_type public.section_type not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  title public.i18n not null default '{}',
  subtitle public.i18n not null default '{}',
  settings jsonb not null default '{}' check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index page_sections_page_idx on public.page_sections (page_key, sort_order);

create trigger page_sections_updated_at before update on public.page_sections
  for each row execute function public.set_updated_at();

alter table public.page_sections enable row level security;

create policy "page_sections: read active" on public.page_sections
  for select to anon, authenticated using (is_active or public.is_staff());
create policy "page_sections: editor insert" on public.page_sections
  for insert to authenticated with check (public.is_editor());
create policy "page_sections: editor update" on public.page_sections
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "page_sections: editor delete" on public.page_sections
  for delete to authenticated using (public.is_editor());
