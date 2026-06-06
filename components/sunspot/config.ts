/**
 * Public configuration for the SunSpot · Golden Hour Explorer showcase.
 *
 * The Supabase URL and the *publishable* (anon) key are designed to be embedded
 * in client code — database access is governed by Row Level Security, so these
 * values are safe to ship publicly. They can still be overridden at build time
 * via NEXT_PUBLIC_* environment variables.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://enaiwztlekfvcmsblltd.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_QKwZDZCgcI_l7CeBc5Pf9g_M6bViift";

/** Keyless demo basemap — no MapTiler key required for the showcase. */
export const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE ?? "https://demotiles.maplibre.org/style.json";
