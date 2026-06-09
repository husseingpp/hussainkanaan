-- Move PostGIS out of `public` into the dedicated `extensions` schema (Supabase
-- best practice). Installing it in `public` exposed PostGIS internals through the
-- API and tripped advisors: extension_in_public, the st_estimatedextent
-- SECURITY DEFINER warnings, and an ERROR-level rls_disabled_in_public on the
-- PostGIS `spatial_ref_sys` reference table.
--
-- Safe because the only objects depending on PostGIS are the ones 0005 created
-- (the generated `spots.geog` column, its GiST index, and nearby_spots()); geog
-- is generated from lat/lng so dropping/recreating it loses no data. Guarded so
-- it only relocates when PostGIS is currently in `public`, and the recreate uses
-- if-not-exists / or-replace, making the whole migration idempotent.

do $$
begin
  if exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'postgis' and n.nspname = 'public'
  ) then
    execute 'drop function if exists public.nearby_spots(double precision, double precision, integer)';
    execute 'alter table public.spots drop column if exists geog';
    execute 'drop extension if exists postgis';
  end if;
end $$;

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
set search_path = public, extensions;

alter table public.spots
  add column if not exists geog geography(Point, 4326)
  generated always as (
    st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
  ) stored;

create index if not exists spots_geog_gix on public.spots using gist (geog);

create or replace function public.nearby_spots(
  lat double precision,
  lng double precision,
  max_count integer default 200
)
returns table (
  id uuid,
  name text,
  description text,
  latitude double precision,
  longitude double precision,
  type text,
  status text,
  best_months text[],
  photo_urls text[],
  author_id uuid,
  average_rating double precision,
  ratings_count integer,
  created_at timestamptz,
  updated_at timestamptz,
  distance_m double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    s.id::uuid,
    s.name::text,
    s.description::text,
    s.latitude::double precision,
    s.longitude::double precision,
    s.type::text,
    s.status::text,
    s.best_months::text[],
    s.photo_urls::text[],
    s.author_id::uuid,
    s.average_rating::double precision,
    s.ratings_count::integer,
    s.created_at::timestamptz,
    s.updated_at::timestamptz,
    st_distance(
      s.geog,
      st_setsrid(st_makepoint(lng, lat), 4326)::geography
    )::double precision as distance_m
  from public.spots s
  where s.status::text = 'approved'
  order by s.geog <-> st_setsrid(st_makepoint(lng, lat), 4326)::geography
  limit max_count;
$$;

grant execute on function public.nearby_spots(double precision, double precision, integer)
  to anon, authenticated;
