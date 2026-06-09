-- Additive PostGIS support for efficient "spots near me" queries.
--
-- Adds a generated `geography` column on spots (auto-maintained from the existing
-- latitude/longitude — no app or insert changes needed), a GiST index on it, and
-- a `nearby_spots()` RPC that returns approved spots ordered by distance with the
-- distance baked in. The app's read hooks select an explicit column list (never
-- `*`), so the new column is invisible to them.
--
-- search_path includes `extensions` because Supabase may install PostGIS there;
-- a non-existent schema in search_path is ignored, so this is safe either way.

create extension if not exists postgis;
set search_path = public, extensions;

-- Generated geography point (lng, lat). STORED so the GiST index can use it.
alter table public.spots
  add column if not exists geog geography(Point, 4326)
  generated always as (
    st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
  ) stored;

create index if not exists spots_geog_gix on public.spots using gist (geog);

-- Approved spots ordered by distance from (lat,lng), nearest first, with the
-- distance in metres. Columns are cast explicitly so the signature is stable
-- whether the underlying `type`/`status` are enums or text.
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
