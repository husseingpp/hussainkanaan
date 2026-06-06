/**
 * Public runtime config. The Supabase publishable (anon) key is safe to ship in
 * the app — access is enforced by Postgres Row Level Security. Override any of
 * these with EXPO_PUBLIC_* env vars (see .env.example).
 */
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://enaiwztlekfvcmsblltd.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_QKwZDZCgcI_l7CeBc5Pf9g_M6bViift";

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY;

/** Vector basemap. Falls back to MapLibre's keyless demo style. */
export const MAP_STYLE =
  process.env.EXPO_PUBLIC_MAP_STYLE ??
  (MAPTILER_KEY
    ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`
    : "https://demotiles.maplibre.org/style.json");

export const SPOT_IMAGES_BUCKET = "spot-images";

/** Default map center when we have no spots / location yet (Beirut). */
export const DEFAULT_CENTER: [number, number] = [35.5018, 33.8938];
